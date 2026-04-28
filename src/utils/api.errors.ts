import { StatusCodes } from 'http-status-codes';

export default class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public status: string = 'error',
  ) {
    super(message);
    this.status = status;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad Request') {
    super(message, StatusCodes.BAD_REQUEST);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, StatusCodes.NOT_FOUND);
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal Server Error') {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

export class BadGatewayError extends ApiError {
  constructor(message: string = 'Bad Gateway', status: string = 'error') {
    super(message, StatusCodes.BAD_GATEWAY, status);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = 'Validation Error') {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY);
  }
}

export class ForbiddenError extends ApiError{
  constructor(message: string = "Forbidden error") {
    super(message, StatusCodes.FORBIDDEN)
  }
}
