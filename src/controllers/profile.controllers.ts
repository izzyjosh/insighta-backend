import { Request, Response, NextFunction } from 'express';

import { profileService } from '../services/genderize.services';
import { BadRequestError } from '../utils/api.errors';
import { successResponse } from '../utils/responses';
import { StatusCodes } from 'http-status-codes';

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
      const result = await profileService.getProfile(id);

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
      await profileService.deleteProfile(id);
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
      const results = await profileService.naturalSearch(validatedQuery);
      res.status(StatusCodes.OK).json(
        successResponse<ProfileResponseDTO[]>({
          data: results.profiles,
          page: results.page,
          limit: results.limit,
          total: results.total,
        }),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
