// //import { redisClient } from "../config/redis";

// class CacheService {
//   async get<T>(key: string): Promise<T | null> {
//     const cachedData = await redisClient.get(key);
//     if (cachedData) {
//       return JSON.parse(cachedData) as T;
//     }
//     return null;
//   }

//   async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
//     const stringValue = JSON.stringify(value);
//     await redisClient.set(key, stringValue, { EX: ttl });
//   }

//   async del(key: string): Promise<void> {
//     await redisClient.del(key);
//   }
// }

// export const cacheService = new CacheService();
