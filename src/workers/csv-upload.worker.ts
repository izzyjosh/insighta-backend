import { Worker, Processor } from 'bullmq';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { stat } from 'fs/promises';
import sysLogger from '../utils/logger';
import { AppDataSource } from '../config/datasource';
import { Gender, AgeGroup } from '../models/Profile.models';
import {
  bulkImportService,
  UploadSummary,
} from '../services/bulk-import.service';
import { streamCSVChunks } from '../utils/csv-parser';
import { CsvUploadJobData, UploadJobResult } from '../config/csv-queue';
import { connection, redisClient } from '../config/redis';
import { cacheService } from '../services/cache.service';

type ValidatedRow = {
  name: string;
  gender: Gender;
  gender_probability: number;
  age: number;
  age_group: AgeGroup;
  country_id: string;
  country_name: string;
  country_probability: number;
};

type BulkUploadStatus = {
  uploadId: string;
  state: 'queued' | 'active' | 'completed' | 'failed';
  progress: number;
  summary: UploadJobResult | null;
  result: UploadJobResult | null;
  isFailed: boolean;
  failedReason: string | null;
};

const bulkUploadStatusKey = (uploadId: string) =>
  `bulk-upload:${uploadId}:status`;

async function writeBulkUploadStatus(status: BulkUploadStatus): Promise<void> {
  await redisClient.set(
    bulkUploadStatusKey(status.uploadId),
    JSON.stringify(status),
    {
      EX: 60 * 60 * 24,
    },
  );
}

/**
 * CSV Upload Job Processor
 * Handles streaming CSV parsing, validation, and batch insertion
 */
const csvUploadProcessor: Processor<CsvUploadJobData, UploadJobResult> = async (
  job,
) => {
  const { uploadId, fileName, filePath } = job.data;
  const startTime = Date.now();
  const fileStream = createReadStream(filePath);

  // Estimate total rows from file size so progress can be meaningful
  let estimatedTotalRows = 500000; // fallback
  try {
    const st = await stat(filePath);
    // assume average 100 bytes per row as a heuristic
    const avgRowBytes = 100;
    estimatedTotalRows = Math.max(1, Math.round(st.size / avgRowBytes));
    sysLogger.info(`[${uploadId}] Estimated total rows: ${estimatedTotalRows}`);
  } catch (err) {
    sysLogger.warn(
      `[${uploadId}] Failed to stat file for progress estimate: ${err}`,
    );
  }

  sysLogger.info(
    `[${uploadId}] Starting CSV upload: ${fileName} (${filePath})`,
  );

  const summary: UploadSummary = {
    uploadId,
    total_rows: 0,
    inserted: 0,
    skipped: 0,
    reasons: {
      missing_fields: 0,
      invalid_age: 0,
      invalid_gender: 0,
      duplicate_name: 0,
      malformed_row: 0,
      invalid_country: 0,
      invalid_probability: 0,
    },
    duration_ms: 0,
    status: 'success',
  };

  try {
    // Ensure DB is ready
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    await writeBulkUploadStatus({
      uploadId,
      state: 'active',
      progress: 0,
      summary: summary as UploadJobResult,
      result: null,
      isFailed: false,
      failedReason: null,
    });

    // Process CSV in chunks (500 rows per batch)
    const BATCH_SIZE = 500;
    let batchCount = 0;
    const existingNames = new Set<string>();

    for await (const chunk of streamCSVChunks(fileStream, BATCH_SIZE)) {
      batchCount++;
      const chunkSize = chunk.length;
      summary.total_rows += chunkSize;

      // Validate all rows in chunk
      const validatedBatch: ValidatedRow[] = [];
      const skipReasons = summary.reasons;

      for (const row of chunk) {
        try {
          const validation = bulkImportService.validateRow(row);
          if (validation.valid) {
            validatedBatch.push(validation.data);
          } else {
            skipReasons[validation.reason]++;
          }
        } catch (e) {
          sysLogger.warn(`[${uploadId}] Row validation error: ${e}`);
          skipReasons.malformed_row++;
        }
      }

      if (validatedBatch.length > 0) {
        const batchNames = validatedBatch.map((row) => row.name);
        const dbExistingNames =
          await bulkImportService.loadExistingNames(batchNames);

        for (const name of dbExistingNames) {
          existingNames.add(name);
        }
      }

      // Process validated batch (insert + cache)
      if (validatedBatch.length > 0) {
        try {
          const { inserted, skipped } = await bulkImportService.processBatch(
            validatedBatch,
            uploadId,
            existingNames,
          );
          summary.inserted += inserted;

          for (const [reason, count] of Object.entries(skipped)) {
            skipReasons[reason as keyof typeof skipReasons] += count;
          }

          sysLogger.info(
            `[${uploadId}] Batch ${batchCount}: processed ${chunkSize} rows, inserted ${inserted}, skipped ${chunkSize - inserted}`,
          );
        } catch (error) {
          sysLogger.error(
            `[${uploadId}] Batch ${batchCount} insert failed: ${error}`,
          );
          summary.status = 'partial';
        }
      } else {
        sysLogger.info(
          `[${uploadId}] Batch ${batchCount}: all ${chunkSize} rows skipped`,
        );
      }

      // Report progress to job
      const progress = Math.min(
        100,
        Math.round((summary.total_rows / estimatedTotalRows) * 100),
      );
      await job.updateProgress(progress);
      await writeBulkUploadStatus({
        uploadId,
        state: 'active',
        progress,
        summary: summary as UploadJobResult,
        result: null,
        isFailed: false,
        failedReason: null,
      });
    }

    summary.duration_ms = Date.now() - startTime;
    summary.skipped = summary.total_rows - summary.inserted;

    await cacheService.invalidatePattern('profiles:list:*');
    await cacheService.invalidatePattern('profiles:count:*');
    await cacheService.invalidatePattern('profiles:search:*');

    // Do not mark an upload as failed just because zero rows were inserted.
    // Zero inserted may indicate all rows were duplicates; treat as completed
    // unless an explicit error occurred.
    const result = summary as UploadJobResult;
    await writeBulkUploadStatus({
      uploadId,
      state: summary.status === 'failed' ? 'failed' : 'completed',
      progress: 100,
      summary: summary as UploadJobResult,
      result,
      isFailed: summary.status === 'failed',
      failedReason: summary.status === 'failed' ? 'Processing error' : null,
    });

    sysLogger.info(`[${uploadId}] Upload complete: ${JSON.stringify(summary)}`);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    sysLogger.error(`[${uploadId}] Upload failed: ${errorMsg}`);

    summary.status = 'failed';
    summary.duration_ms = Date.now() - startTime;

    await writeBulkUploadStatus({
      uploadId,
      state: 'failed',
      progress: 100,
      summary: summary as UploadJobResult,
      result: {
        ...summary,
        error: errorMsg,
      } as UploadJobResult,
      isFailed: true,
      failedReason: errorMsg,
    });

    return {
      ...summary,
      error: errorMsg,
    } as UploadJobResult;
  } finally {
    fileStream.destroy();
    try {
      await unlink(filePath);
      sysLogger.info(`[${uploadId}] Removed temp upload file`);
    } catch (error) {
      sysLogger.warn(
        `[${uploadId}] Failed to remove temp upload file: ${error}`,
      );
    }
  }
};

/**
 * Create and configure the CSV upload worker
 */
export function createCsvUploadWorker(concurrency: number = 2) {
  const worker = new Worker<CsvUploadJobData, UploadJobResult>(
    'csv-uploads',
    csvUploadProcessor,
    {
      connection,
      concurrency, // Number of concurrent jobs
    },
  );

  worker.on('completed', (job) => {
    sysLogger.info(`Worker: Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    sysLogger.error(`Worker: Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (error) => {
    sysLogger.error(`Worker error: ${error}`);
  });

  return worker;
}
