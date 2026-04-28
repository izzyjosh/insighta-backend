import express from 'express';
import sysLogger, { httpLogger } from './utils/logger';
import {
  NotFoundErrorHandler,
  RequestErrorHandler,
} from './middlewares/errors.handlers';
import { StatusCodes } from 'http-status-codes';
import profileRouter from './routes/profile';
import { authRouter } from './routes/auth';
import cors from 'cors';
import { config } from './config/config';
import { AppDataSource } from './config/datasource';

const port = config.port;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: '*',
  }),
);

app.use(httpLogger);

app.use('/api/', profileRouter);
app.use('/api/auth', authRouter);
app.get('/', (req, res) => {
  const response = {
    status: 'success',
    message: 'Welcome to the Insighta Backend Service!',
  };
  res.status(StatusCodes.OK).json(response);
});

// Error handlers middlewares
app.use(NotFoundErrorHandler);
app.use(RequestErrorHandler);

(async () => {
  try {
    await AppDataSource.initialize();
    sysLogger.info('Database connection established successfully');
    app.listen(port, () => {
      sysLogger.info(`Server is running on port ${port}`);
    });
  } catch (error) {
    sysLogger.error(`Failed to initialize database connection ${error}`);
    process.exit(1);
  }
})();
