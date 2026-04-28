import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from './config';
import { Profile } from '../models/Profile.models';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.databaseUrl,
  synchronize: true,
  // ssl: {
  //   rejectUnauthorized: false,
  // },
  // extra: {
  //   max: 10, // connection pool size (optional)
  // },
  logging: ['error'],
  entities: [Profile],
  migrations: ['src/migrations/**/*.ts'],
});
