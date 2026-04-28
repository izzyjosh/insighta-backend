// import { cacheService } from "../services/cache.service";

// type cacheOptions = {
//   ttl?: number; // Time to live in seconds
//   key?: (...args: any[]) => string; // Function to generate cache key based on method arguments
// };

// export function cache(options: cacheOptions = {}) {
//   const { ttl = 300, key } = options;

//   return function (
//     target: any,
//     propertyName: string,
//     descriptor: PropertyDescriptor,
//   ) {
//     const originalMethod = descriptor.value;

//     descriptor.value = async function (...args: any[]) {
//       // generate cache key
//       const cacheKey =
//         key?.(...args) || `${propertyName}:${JSON.stringify(args)}`;

//       const cached = await cacheService.get(cacheKey);
//       if (cached) return cached;

//       const result = await originalMethod.apply(this, args);

//       await cacheService.set(cacheKey, result, ttl);

//       return result;
//     };
//     return descriptor;
//   };
// }
