import pino from 'pino';
import { NextFunction, Request, Response } from 'express';

const sysLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
      ignore: 'pid,hostname',
    },
  },
});

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(2)}ms`;

    if (res.statusCode >= 500) {
      sysLogger.error(line);
      return;
    }

    if (res.statusCode >= 400) {
      sysLogger.warn(line);
      return;
    }

    sysLogger.info(line);
  });

  next();
};

export default sysLogger;
