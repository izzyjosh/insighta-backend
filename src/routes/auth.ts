import { Router } from 'express';
import { authController } from '../controllers/auth.controllers';

export const authRouter = Router();

authRouter.get('/github', async (req, res, next) => {
  authController.github(req, res, next);
});
authRouter.get('/github/callback', async (req, res, next) => {
  authController.githubCallback(req, res, next);
});
authRouter.post('/refresh', async (req, res, next) => {
  authController.refreshToken(req, res, next);
});
authRouter.post('/logout', async (req, res, next) => {
  authController.logout(req, res, next);
});
