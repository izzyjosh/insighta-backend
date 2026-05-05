import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from './config';
import { Profile } from '../models/Profile.models';
import { User } from '../models/User.model';
import { RefreshToken } from '../models/RefreshToken';
import { minLength } from 'zod';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.databaseUrl,
  synchronize: true,
  ssl: {
    rejectUnauthorized: false,
  },
  extra: {
    max: 25, // connection pool size (optional)
    min: 5, // minimum connections in pool (optional)
  },
  logging: ['error'],
  entities: [Profile, User, RefreshToken],
  migrations: ['src/migrations/**/*.ts'],
});
