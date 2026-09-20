import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { healthRouter } from './routes/healthRoutes';
import { resumeRouter } from './routes/resumeRoutes';
import { jobRouter } from './routes/jobRoutes';
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
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
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
