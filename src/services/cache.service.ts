import { redisClient } from '../config/redis';
import sysLogger from '../utils/logger';

class CacheService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return JSON.parse(cachedData) as T;
      }
      return null;
    } catch (error) {
      sysLogger.error(`Cache get error: ${error}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      await redisClient.set(key, stringValue, { EX: ttl });
    } catch (error) {
      sysLogger.error(`Cache set error: ${error}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      sysLogger.error(`Cache del error: ${error}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      sysLogger.error(`Cache invalidation error: ${error}`);
    }
  }
}

export const cacheService = new CacheService();
