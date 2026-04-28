import { NextFunction, Request, Response } from 'express';
import { redisClient } from '../config/redis';
import { TooManyRequestsError } from '../utils/api.errors';

type RateLimitScope = 'auth' | 'user';

type RequestUser = {
  id: string;
};

interface RequestWithUser extends Request {
  user?: RequestUser;
}

const WINDOW_SECONDS = 60;
const AUTH_LIMIT = 10;
const USER_LIMIT = 60;

async function enforceRateLimit(
  req: RequestWithUser,
  scope: RateLimitScope,
  limit: number,
  next: NextFunction,
) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const identifier = scope === 'auth' ? ip : (req.user?.id ?? ip);
  const key = `rate:${scope}:${identifier}`;

  try {
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.expire(key, WINDOW_SECONDS);
    }

    if (current > limit) {
      return next(new TooManyRequestsError('Too Many Requests'));
    }

    return next();
  } catch {
    return next();
  }
}

export const authRateLimit = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  return enforceRateLimit(req as RequestWithUser, 'auth', AUTH_LIMIT, next);
};

export const userRateLimit = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  return enforceRateLimit(req as RequestWithUser, 'user', USER_LIMIT, next);
};
