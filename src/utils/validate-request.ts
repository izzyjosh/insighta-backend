import { NextFunction, Request, Response } from 'express';
import { ValidationError, BadRequestError } from './api.errors';
import { z } from 'zod';

interface ValidatedRequest extends Request {
  validatedBody?: Record<string, unknown>;
  validatedQuery?: Record<string, unknown>;
}

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

export const requestSchema = z.object({
  name: z.string().trim().min(1, 'name cannot be empty'),
});

export const validateRequest =
  (schema = requestSchema) =>
  (req: ValidatedRequest, _res: Response, next: NextFunction): void => {
    const body = req.body;

    if (body === undefined || body === null || typeof body !== 'object') {
      next(new BadRequestError('Missing body'));
      return;
    }

    const data = (body as Record<string, unknown>).name;

    if (data === undefined || data === null) {
      next(new BadRequestError('Missing name parameter'));
      return;
    }

    if (Array.isArray(data) || typeof data !== 'string') {
      next(new ValidationError('name is not a string'));
      return;
    }

    const trimmedValue = data.trim();
    if (!trimmedValue) {
      next(new BadRequestError('Missing or empty name parameter'));
      return;
    }

    if (NUMERIC_PATTERN.test(trimmedValue)) {
      next(new ValidationError('name is not a string'));
      return;
    }

    const validatedData = schema.parse({ name: trimmedValue });
    req.validatedBody = validatedData;
    next();
  };

// Query parameters validation
export const validateQueryParams =
  (querySchema: z.ZodType) =>
  (req: ValidatedRequest, res: Response, next: NextFunction): void => {
    const validateQuery = querySchema.safeParse(req.query);
    if (!validateQuery.success) {
      next(new ValidationError('Invalid query parameters'));
      return;
    }
    req.validatedQuery = validateQuery;
    next();
  };
