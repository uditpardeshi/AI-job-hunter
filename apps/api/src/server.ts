import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { healthRouter } from './routes/healthRoutes';
import { resumeRouter } from './routes/resumeRoutes';
import { jobRouter } from './routes/jobRoutes';
import matchRouter from './routes/matchRoutes';
import tailoringRouter from './routes/tailoringRoutes';
import applicationRouter from './routes/applicationRoutes';
import dashboardRouter from './routes/dashboardRoutes';
import gmailRouter from './routes/gmailRoutes';
import emailRouter from './routes/emailRoutes';
import automationRouter from './routes/automationRoutes';
import approvalRouter from './routes/approvalRoutes';
import { QueueManager } from './queues/queueManager';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { pool } from './db';
import { redis } from './services/redis';
import { runMigrations } from './db/migrations';

const app = express();

// Middleware
app.use(express.json());

// CORS configuration
const allowedOrigins = config.corsOrigin.split(',').map((origin: string) => origin.trim());
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  })
);

// Mount health routes at both / and /api
app.use(healthRouter);
app.use('/api', healthRouter);

// Mount resume & candidate profile routes
app.use(resumeRouter);
app.use('/api', resumeRouter);

// Mount jobs and job sources routes
app.use(jobRouter);
app.use('/api', jobRouter);

// Mount match routes
app.use(matchRouter);
app.use('/api', matchRouter);

// Mount tailoring & cover letter routes
app.use(tailoringRouter);
app.use('/api', tailoringRouter);

// Mount application tracker routes
app.use(applicationRouter);
app.use('/api', applicationRouter);

// Mount dashboard routes
app.use(dashboardRouter);
app.use('/api', dashboardRouter);

// Mount Gmail integration routes
app.use(gmailRouter);
app.use('/api', gmailRouter);

// Mount email assistant routes
app.use(emailRouter);
app.use('/api', emailRouter);

// Mount automation routes
app.use('/automation', automationRouter);
app.use('/api/automation', automationRouter);

// Mount approval queue routes
app.use('/approvals', approvalRouter);
app.use('/api/approvals', approvalRouter);

// Fallback route for 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
  });
});

// Centralized error handling
app.use(errorHandler);

// Start server
const server = app.listen(config.port, async () => {
  logger.info(`API Server running in ${config.env} mode on port ${config.port}`);
  logger.info(`CORS allowed origins: ${config.corsOrigin}`);
  logger.info(`PostgreSQL target: ${config.databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  logger.info(`Redis target: ${config.redisUrl}`);
  logger.info(`AI Service target: ${config.aiServiceUrl}`);

  try {
    await runMigrations();
  } catch (migErr) {
    logger.error('Failed to run initial migrations on startup:', migErr);
  }

  try {
    QueueManager.initWorkers();
  } catch (qErr) {
    logger.warn('Failed to initialize QueueManager workers:', qErr);
  }
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await QueueManager.closeAll();
      logger.info('QueueManager queues closed.');
    } catch (e) {
      logger.warn('Error closing QueueManager:', e);
    }
    try {
      await pool.end();
      logger.info('PostgreSQL pool closed.');
    } catch (e) {
      logger.error('Error closing PostgreSQL pool:', e);
    }
    try {
      redis.disconnect();
      logger.info('Redis client disconnected.');
    } catch (e) {
      logger.error('Error disconnecting Redis:', e);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
