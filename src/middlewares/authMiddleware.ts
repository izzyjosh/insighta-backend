import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/api.errors';
import { verifyToken } from '../utils/auth_helper';
import { User } from '../models/User.model';
import { AppDataSource } from '../config/datasource';

type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: string;
};

interface AuthRequest extends Request {
  user?: AuthUser;
}

const userRepo = AppDataSource.getRepository(User);

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    token = (req.cookies as { accessToken?: string } | undefined)?.accessToken;
  }

  if (!token) {
    return next(new UnauthorizedError('No token provided'));
  }
  try {
    const payload = verifyToken(token);

    if (!payload) {
      return next(new UnauthorizedError('Invalid token'));
    }
    req.user = payload;

    const user = await userRepo.findOneBy({ id: payload.id });
    if (!user?.is_active) {
      return next(new ForbiddenError('User account is inactive'));
    }
    next();
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
};

export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('No token provided'));
    }
    if (req.user.role !== role) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}
