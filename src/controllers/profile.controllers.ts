import { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/genderize.services';
import { BadRequestError } from '../utils/api.errors';
import { successResponse } from '../utils/responses';
import { StatusCodes } from 'http-status-codes';
import { uuidSchema } from '../schemas/profile.schemas';

import {
  FilterQueryDTO,
  ListProfileDTO,
  ProfileResponseDTO,
  NaturalSearchDTO,
} from '../schemas/profile.schemas';

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
      const validatedQuery = req.validatedQuery?.success
        ? req.validatedQuery.data
        : undefined;
      if (!validatedQuery) {
        next(new BadRequestError('Invalid query parameters'));
        return;
      }
      const results: Awaited<ReturnType<typeof profileService.naturalSearch>> =
        await profileService.naturalSearch(validatedQuery);
      res.status(StatusCodes.OK).json(
        successResponse<ProfileResponseDTO[]>({
          data: results.profiles,
          page: results.page,
          limit: results.limit,
          total: results.total,
          requestPath: req.originalUrl,
        }),
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
}

export const profileController = new ProfileController();
