import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.services';
import { successResponse } from '../utils/responses';
import { BadRequestError } from '../utils/api.errors';

class AuthController {
  async github(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const url = await authService.githubRedirect();
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  async githubCallback(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { code, state } = req.query;
      if (typeof code !== 'string' || typeof state !== 'string') {
        throw new BadRequestError('Invalid code or state');
      }
      const result = await authService.githubCallback(code, state);

      res.status(201).json(
        successResponse({
          data: result,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (typeof refreshToken !== 'string') {
        throw new BadRequestError('Invalid refresh token');
      }
      const result = await authService.refreshToken(refreshToken);
      res.status(200).json(
        successResponse({
          data: result,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (typeof refreshToken !== 'string') {
        throw new BadRequestError('Invalid refresh token');
      }
      await authService.logout(refreshToken);
      res.status(204);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
