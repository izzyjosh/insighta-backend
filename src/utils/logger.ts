import pino from 'pino';
import pinoHttp from 'pino-http';

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

export const httpLogger = pinoHttp({
  logger: sysLogger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req() {
      return undefined;
    },
    res() {
      return undefined;
    },
    responseTime() {
      return undefined;
    },
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `Error processing ${req.method} ${req.url} - ${err.message}`;
  },
});

export default sysLogger;
