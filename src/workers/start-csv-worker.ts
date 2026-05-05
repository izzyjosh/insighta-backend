import sysLogger from '../utils/logger';
import { createCsvUploadWorker } from './csv-upload.worker';

const concurrency = Number(process.env.CSV_WORKER_CONCURRENCY || 2);

sysLogger.info(
  `Starting CSV worker with concurrency=${Number.isNaN(concurrency) ? 2 : concurrency}`,
);

const worker = createCsvUploadWorker(
  Number.isNaN(concurrency) ? 2 : concurrency,
);

const shutdown = async (signal: string) => {
  sysLogger.info(`Received ${signal}. Closing CSV worker...`);
  try {
    await worker.close();
    sysLogger.info('CSV worker closed');
    process.exit(0);
  } catch (error) {
    sysLogger.error(`Failed to close CSV worker: ${error}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('uncaughtException', (error) => {
  sysLogger.error(`Uncaught exception in CSV worker: ${error}`);
});

process.on('unhandledRejection', (reason) => {
  sysLogger.error(`Unhandled rejection in CSV worker: ${reason}`);
});

export default worker;
