import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z
    .string()
    .url('REDIS_URL must be a valid URL')
    .default('redis://localhost:6379'),
  GITHUB_CLIENT_SECRET: z.string().min(32).max(256),
  GITHUB_CLIENT_ID: z.string().min(20).max(256),
  BASE_URL: z
    .string()
    .url('BASE_URL must be a valid URL')
    .default('http://localhost:3000'),
  FRONTEND_URL: z
    .string()
    .url('FRONTEND_URL must be a valid URL')
    .default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32).max(256),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  github: {
    clientSecret: env.GITHUB_CLIENT_SECRET,
    clientId: env.GITHUB_CLIENT_ID,
  },
  url: {
    base: env.BASE_URL,
    frontend: env.FRONTEND_URL,
  },
  secret: {
    jwtsecret: env.JWT_SECRET,
  },
  nodeEnv: env.NODE_ENV,
};
