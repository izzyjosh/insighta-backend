import { cacheService } from '../services/cache.service';

type CacheOptions<T extends unknown[] = unknown[]> = {
  ttl?: number; // Time to live in seconds
  key?: (...args: T) => string; // Function to generate cache key based on method arguments
};

export function cache<T extends unknown[] = unknown[]>(
  options: CacheOptions<T> = {},
) {
  const { ttl = 300, key } = options;

  return function (
    target: object,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      this: unknown,
      ...args: unknown[]
    ) => Promise<unknown> | unknown;

    descriptor.value = async function (...args: unknown[]) {
      // generate cache key
      const cacheKey =
        (key as (...a: unknown[]) => string)?.(...(args as unknown as T)) ||
        `${propertyName}:${JSON.stringify(args)}`;

      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const result = await originalMethod.apply(this, args);

      await cacheService.set(cacheKey, result, ttl);

      return result;
    };
    return descriptor;
  };
}
