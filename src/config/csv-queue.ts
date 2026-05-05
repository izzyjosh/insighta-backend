import { Queue, QueueEvents } from 'bullmq';
import sysLogger from '../utils/logger';
import { connection } from './redis';

export type CsvUploadJobData = {
  uploadId: string;
  fileName: string;
  filePath: string;
  adminId?: string;
  timestamp: number;
};

export type UploadJobResult = {
  uploadId: string;
  total_rows: number;
  inserted: number;
  skipped: number;
  reasons: Record<string, number>;
  duration_ms: number;
  status: 'success' | 'partial' | 'failed';
  error?: string;
};

/**
 * CSV Upload Job Queue
 * Processes CSV file uploads in background with worker pattern.
 */
export const csvUploadQueue = new Queue<CsvUploadJobData, UploadJobResult>(
  'csv-uploads',
  {
    connection: connection,
    defaultJobOptions: {
      attempts: 2, // Retry once on failure
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep successful jobs for 1 hour
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours for debugging
      },
    },
  },
);

/**
 * Queue events for monitoring
 */
export const csvUploadQueueEvents = new QueueEvents('csv-uploads', {
  connection,
});

// Event listeners
csvUploadQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  // pino's typings prefer an object first, then an optional message string
  sysLogger.info(
    { jobId, result: returnvalue },
    `CSV upload job ${jobId} completed`,
  );
});

csvUploadQueueEvents.on('failed', ({ jobId, failedReason }) => {
  sysLogger.error(`CSV upload job ${jobId} failed: ${failedReason}`);
});

csvUploadQueueEvents.on('error', (error) => {
  sysLogger.error(`Queue error: ${error}`);
});

// Initialize queue
(async () => {
  try {
    await csvUploadQueue.waitUntilReady();
    sysLogger.info('CSV upload queue initialized');
  } catch (error) {
    sysLogger.error(`Failed to initialize CSV upload queue: ${error}`);
  }
})();

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  sysLogger.info('Closing CSV upload queue...');
  await csvUploadQueue.close();
  await csvUploadQueueEvents.close();
});
