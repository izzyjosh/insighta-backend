import express from 'express';
import sysLogger, { requestLogger } from './utils/logger';
import {
  NotFoundErrorHandler,
  RequestErrorHandler,
} from './middlewares/errors.handlers';
import { StatusCodes } from 'http-status-codes';
import profileRouter from './routes/profile';
import { authRouter } from './routes/auth';
import cors from 'cors';
import { config } from './config/config';
import { AppDataSource } from './config/datasource';
import { cacheService } from './services/cache.service';
import { Profile } from './models/Profile.models';
import { authMiddleware } from './middlewares/authMiddleware';
import { apiVersion } from './middlewares/versionMiddleware';
import { authRateLimit, userRateLimit } from './middlewares/rateLimit';
import cookieParser from 'cookie-parser';
import { authController } from './controllers/auth.controllers';

const port = config.port;

const app = express();
app.set('etag', false);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use('/api', (req, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('ETag');
  next();
});

app.use(
  cors({
    origin: config.url.frontend,
    credentials: true,
  }),
);

app.use(requestLogger);

app.use('/auth', authRateLimit, authRouter);
app.use('/api/auth', authRateLimit, authRouter);

// Add /api/users/me endpoint for API compatibility
app.get(
  '/api/users/me',
  authMiddleware,
  userRateLimit,
  apiVersion,
  async (req, res, next) => {
    authController.getMe(req, res, next);
  },
);

app.use(
  '/api/profiles',
  authMiddleware,
  userRateLimit,
  apiVersion,
  profileRouter,
);

app.get('/', (req, res) => {
  const response = {
    status: 'success',
    message: 'Welcome to the Insighta Backend Service!',
  };
  res.status(StatusCodes.OK).json(response);
});

// Error handlers middleware (MUST be last)
// RequestErrorHandler catches APIError and returns appropriate status codes (401, 403, 404, etc.)
// NotFoundErrorHandler returns 404 as a fallback
app.use(RequestErrorHandler);
app.use(NotFoundErrorHandler);

(async () => {
  try {
    await AppDataSource.initialize();
    sysLogger.info('Database connection established successfully');
    // Initialize profiles total counter in Redis if not present
    try {
      const current = await cacheService.getNumber('profiles:total');
      if (current === null) {
        const count = await AppDataSource.getRepository(Profile).count();
        await cacheService.set('profiles:total', count, 0);
        sysLogger.info(`Initialized profiles:total counter -> ${count}`);
      } else {
        sysLogger.info(`profiles:total already set -> ${current}`);
      }
    } catch (err) {
      sysLogger.error(`Failed initializing profiles counter: ${err}`);
    }
    app.listen(port, () => {
      sysLogger.info(`Server is running on port ${port}`);
    });
  } catch (error) {
    sysLogger.error(`Failed to initialize database connection ${error}`);
    process.exit(1);
  }
})();
