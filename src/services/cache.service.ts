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
      if (ttl > 0) {
        await redisClient.set(key, stringValue, { EX: ttl });
      } else {
        await redisClient.set(key, stringValue);
      }
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

  async incr(key: string): Promise<number> {
    try {
      const v = await redisClient.incr(key);
      return Number(v);
    } catch (error) {
      sysLogger.error(`Cache incr error: ${error}`);
      return 0;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      const v = await redisClient.decr(key);
      return Number(v);
    } catch (error) {
      sysLogger.error(`Cache decr error: ${error}`);
      return 0;
    }
  }

  async getNumber(key: string): Promise<number | null> {
    try {
      const v = await redisClient.get(key);
      if (v === null) return null;
      return Number(v);
    } catch (error) {
      sysLogger.error(`Cache getNumber error: ${error}`);
      return null;
    }
  }
}

export const cacheService = new CacheService();
