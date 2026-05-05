import { createClient } from 'redis';
import { config } from './config';
import sysLogger from '../utils/logger';
import IORedis, { Redis as IORedisClient } from 'ioredis';

declare global {
  var bullRedis: IORedisClient | undefined;
}

export const redisClient = createClient({
  url: config.redisUrl,
});

(async () => {
  await redisClient.connect();
  sysLogger.info('Connected to Redis successfully');
})();

redisClient.on('error', (err) => {
  sysLogger.error(`Redis Client Error: ${err}`);
});

// redis-bull.ts

const connection: IORedisClient =
  globalThis.bullRedis ??
  new IORedis(config.redisUrl!, {
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
  });

connection.on('error', (err: Error) => {
  sysLogger.error(`BullMQ Redis connection error: ${err.message}`);
});

connection.on('close', () => {
  sysLogger.warn('BullMQ Redis connection closed');
});

connection.on('reconnecting', (delay: number) => {
  sysLogger.warn(`BullMQ Redis reconnecting in ${delay}ms`);
});

if (!globalThis.bullRedis) {
  globalThis.bullRedis = connection;
}

export { connection };
