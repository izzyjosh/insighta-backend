import { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/genderize.services';
import { BadRequestError } from '../utils/api.errors';
import { successResponse } from '../utils/responses';
import sysLogger from '../utils/logger';
import { StatusCodes } from 'http-status-codes';
import { uuidSchema } from '../schemas/profile.schemas';
import { redisClient } from '../config/redis';
import { csvUploadQueue, UploadJobResult } from '../config/csv-queue';
import { v7 as uuidv7 } from 'uuid';

import {
  FilterQueryDTO,
  ListProfileDTO,
  ProfileResponseDTO,
  NaturalSearchDTO,
} from '../schemas/profile.schemas';

type RequestWithUser = Request & {
  user?: {
    id: string;
  };
};

type BulkUploadStatus = {
  uploadId: string;
  state: 'queued' | 'active' | 'completed' | 'failed';
  progress: number;
  summary: Record<string, unknown> | null;
  result: unknown | null;
  isFailed: boolean;
  failedReason: string | null;
};

const bulkUploadStatusKey = (uploadId: string) =>
  `bulk-upload:${uploadId}:status`;

interface ValidatedRequest<Body = unknown, Query = unknown> extends Request {
  validatedBody?: Body;
  validatedQuery?:
    | {
        success: true;
        data: Query;
      }
    | {
        success: false;
        error: unknown;
      };
}

class ProfileController {
  async classify(
    req: ValidatedRequest<{ name: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const name = req.validatedBody?.name;
      if (!name) {
        next(new BadRequestError('Missing name parameter'));
        return;
      }
      const result = await profileService.classify(name);
      res.status(result.statusCode).json(
        successResponse<ProfileResponseDTO>({
          data: result.profile,
          ...(result.message !== undefined ? { message: result.message } : {}),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getProfile(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params?.id;
      const validatedId = uuidSchema.safeParse(id);
      if (!validatedId.success) {
        next(new BadRequestError('Invalid profile ID format'));
        return;
      }
      const result = await profileService.getProfile(validatedId.data);

      res
        .status(StatusCodes.OK)
        .json(successResponse<ProfileResponseDTO>({ data: result }));
    } catch (error) {
      next(error);
    }
  }

  async allProfiles(
    req: ValidatedRequest<never, FilterQueryDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedQuery = req.validatedQuery?.success
        ? req.validatedQuery.data
        : undefined;
      if (!validatedQuery) {
        next(new BadRequestError('Invalid query parameters'));
        return;
      }

      const response = await profileService.getAllProfiles(validatedQuery);

      res.status(StatusCodes.OK).json(
        successResponse<ListProfileDTO[]>({
          page: response.page,
          limit: response.limit,
          total: response.total,
          data: response.profiles,
          requestPath: req.originalUrl,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteProfile(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id;
      const validatedId = uuidSchema.safeParse(id);
      if (!validatedId.success) {
        next(new BadRequestError('Invalid profile ID format'));
        return;
      }
      await profileService.deleteProfile(validatedId.data);
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  }

  async naturalSearch(
    req: ValidatedRequest<never, NaturalSearchDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const reqStartTime = Date.now();
      const validatedQuery = req.validatedQuery?.success
        ? req.validatedQuery.data
        : undefined;
      if (!validatedQuery) {
        next(new BadRequestError('Invalid query parameters'));
        return;
      }
      const serviceStartTime = Date.now();
      const results: Awaited<ReturnType<typeof profileService.naturalSearch>> =
        await profileService.naturalSearch(validatedQuery);
      const serviceTime = Date.now() - serviceStartTime;
      
      res.status(StatusCodes.OK).json(
        successResponse<ProfileResponseDTO[]>({
          data: results.profiles,
          page: results.page,
          limit: results.limit,
          total: results.total,
          requestPath: req.originalUrl,
        }),
      );
      
      const totalTime = Date.now() - reqStartTime;
      sysLogger.info(
        `naturalSearch endpoint - Service: ${serviceTime}ms, Total: ${totalTime}ms, Query: ${validatedQuery.q}`,
      );
    } catch (error) {
      next(error);
    }
  }

  async exportProfiles(
    req: ValidatedRequest<never, FilterQueryDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedQuery = req.validatedQuery?.success
        ? req.validatedQuery.data
        : undefined;
      if (!validatedQuery) {
        next(new BadRequestError('Invalid query parameters'));
        return;
      }

      const profiles = await profileService.exportProfiles(validatedQuery);

      const pad = (n: number) => String(n).padStart(2, '0');
      const d = new Date();
      const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
        d.getDate(),
      )}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      const filename = `profiles_${ts}.csv`;

      const escapeCsv = (v: unknown) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const columns = [
        'id',
        'name',
        'gender',
        'gender_probability',
        'age',
        'age_group',
        'country_id',
        'country_name',
        'country_probability',
        'created_at',
      ] as const;

      type CsvColumn = (typeof columns)[number];
      const rowValues = profiles as Array<
        Record<CsvColumn, string | number | Date>
      >;

      const header = columns.join(',');
      const rows = rowValues.map((profile) =>
        columns.map((column) => escapeCsv(profile[column])).join(','),
      );

      const csv = [header, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.status(StatusCodes.OK).send(csv);
    } catch (error) {
      next(error);
    }
  }

  async bulkUploadCSV(
    req: RequestWithUser,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.file) {
        next(new BadRequestError('No file provided'));
        return;
      }

      if (
        req.file.mimetype !== 'text/csv' &&
        !req.file.originalname.endsWith('.csv')
      ) {
        next(new BadRequestError('File must be CSV format'));
        return;
      }

      const uploadId = uuidv7();
      const jobData = {
        uploadId,
        fileName: req.file.originalname,
        filePath: req.file.path,
        timestamp: Date.now(),
        ...(req.user?.id ? { adminId: req.user.id } : {}),
      };

      const queuedStatus: BulkUploadStatus = {
        uploadId,
        state: 'queued',
        progress: 0,
        summary: null,
        result: null,
        isFailed: false,
        failedReason: null,
      };

      // Write status first so status endpoint can read immediately.
      try {
        await redisClient.set(
          bulkUploadStatusKey(uploadId),
          JSON.stringify(queuedStatus),
          {
            EX: 60 * 60 * 24,
          },
        );
      } catch (err) {
        sysLogger.warn(`Failed to write queued status for ${uploadId}: ${err}`);
      }

      const job = await csvUploadQueue.add('csv-upload', jobData, {
        jobId: uploadId,
      });

      res.status(StatusCodes.ACCEPTED).json({
        uploadId,
        jobId: job.id,
        message: 'Upload queued. Check status with uploadId.',
      });
    } catch (error) {
      next(error);
    }
  }

  async getBulkUploadStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { uploadId } = req.params as { uploadId: string };

      const statusJson = await redisClient.get(bulkUploadStatusKey(uploadId));
      if (!statusJson) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: 'Upload not found or already completed',
        });
        return;
      }

      let status: BulkUploadStatus;
      try {
        status = JSON.parse(statusJson) as BulkUploadStatus;
      } catch (err) {
        sysLogger.error(`Corrupt status payload for ${uploadId}: ${err}`);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          error: 'Upload status corrupted',
        });
        return;
      }

      // Map to the requested compact response shape.
      // If final result exists, return its summary fields; otherwise return a processing stub.
      if (status.result) {
        const r = status.result as UploadJobResult;
        res.status(StatusCodes.OK).json({
          status:
            r.status || (status.state === 'failed' ? 'failed' : 'success'),
          total_rows: r.total_rows ?? 0,
          inserted: r.inserted ?? 0,
          skipped: r.skipped ?? 0,
          reasons: r.reasons ?? {},
        });
        return;
      }

      const summary = (status.summary ?? {}) as Record<string, unknown>;

      // In-progress or queued: return processing stub with current progress
      res.status(StatusCodes.OK).json({
        status: status.state === 'failed' ? 'failed' : 'processing',
        total_rows: Number(summary.total_rows ?? 0),
        inserted: Number(summary.inserted ?? 0),
        skipped: Number(summary.skipped ?? 0),
        reasons: summary.reasons ?? {
          duplicate_name: 0,
          invalid_age: 0,
          invalid_country: 0,
          invalid_gender: 0,
          invalid_probability: 0,
          malformed_row: 0,
          missing_fields: 0,
        },
        progress: status.progress,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
