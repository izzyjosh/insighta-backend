import { Queue } from 'bullmq';
import { connection } from '../config/redis';

export const myQueue = new Queue('jobs', {
  connection,
});
