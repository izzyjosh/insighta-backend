import { StatusCodes } from 'http-status-codes';
import { NextFunction, Request, Response } from 'express';
import APIError from '../utils/api.errors';

export const RequestErrorHandler = (
  err: Error | APIError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const statuscode =
    err instanceof APIError
      ? err.statusCode
      : StatusCodes.INTERNAL_SERVER_ERROR;
  const status = err instanceof APIError ? err.status : 'error';
  const message = err.message || 'An unexpected error occurred';

  res.status(statuscode).json({
    status: status,
    message: message,
  });
};

export const NotFoundErrorHandler = (req: Request, res: Response): void => {
  res.status(StatusCodes.NOT_FOUND).json({
    status: 'error',
    message: 'Resource not found',
  });
};
