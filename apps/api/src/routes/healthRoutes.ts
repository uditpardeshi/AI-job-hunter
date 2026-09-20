import { Router } from 'express';
import { HealthController } from '../controllers/healthController';

export const healthRouter = Router();

// Express health check routes
healthRouter.get('/health', HealthController.getApiHealth);
healthRouter.get('/health/ai', HealthController.getAiHealth);
healthRouter.get('/health/db', HealthController.getDbHealth);
healthRouter.get('/health/redis', HealthController.getRedisHealth);
healthRouter.get('/health/all', HealthController.getAllHealth);
