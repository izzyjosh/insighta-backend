// global.d.ts
import IORedis from 'ioredis';

declare global {
  var bullRedis: IORedis | undefined;
}

export {};
