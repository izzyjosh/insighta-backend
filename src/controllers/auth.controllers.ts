import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.services';
import { successResponse } from '../utils/responses';
import { BadRequestError } from '../utils/api.errors';
import { config } from '../config/config';

class AuthController {
  async github(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const source = (req as { query: { source?: string } }).query.source;
      const url = await authService.githubRedirect(source);
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
      const { code, state, source } = req.query;
      if (typeof code !== 'string' || typeof state !== 'string') {
        throw new BadRequestError('Invalid code or state');
      }
      const result = await authService.githubCallback(code, state);

      if (source !== 'cli') {
        const redirectUrl = new URL(
          '/auth/callback',
          config.url.frontend,
        ).toString();

        res.cookie('accessToken', result.token, {
          httpOnly: true,
          secure: config.nodeEnv === 'production',
          sameSite: 'lax',
        });

        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: config.nodeEnv === 'production',
          sameSite: 'lax',
        });

        res.redirect(redirectUrl);
        return;
      }
      if (source === 'cli') {
        res.status(200).json(
          successResponse({
            data: result,
          }),
        );
        return;
      }

      res.status(200).json(
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
      // Allow refresh token to be provided either in the request body or in an httpOnly cookie
      let { refresh_token } = req.body as { refresh_token?: string };
      if (typeof refresh_token !== 'string') {
        refresh_token = (req.cookies as { refresh_token?: string })?.refresh_token;
      }

      if (typeof refresh_token !== 'string') {
        throw new BadRequestError('Invalid refresh token');
      }

      const result = await authService.refreshToken(refresh_token);

      // Set new tokens as httpOnly cookies for browser clients
      res.cookie('accessToken', result.token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
      });

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

      // Clear authentication cookies
      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
      });

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Try to get token from Authorization header first, then from cookies
      let token = (req.headers.authorization || '').split(' ')[1];

      if (!token) {
        token = (req.cookies as { accessToken?: string }).accessToken;
      }

      if (!token) {
        throw new BadRequestError('No token provided');
      }

      const user = await authService.getUserFromToken(token);
      res.status(200).json(
        successResponse({
          data: user,
        }),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
