import { Request, Response } from 'express';
import { testDbConnection } from '../db';
import { pingRedis } from '../services/redis';
import { checkAiHealth } from '../services/aiClient';

export class HealthController {
  public static getApiHealth(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    });
  }

  public static async getDbHealth(_req: Request, res: Response): Promise<void> {
    const dbStatus = await testDbConnection();
    if (dbStatus.ok) {
      res.status(200).json({
        status: 'ok',
        service: 'db',
        latencyMs: dbStatus.latencyMs,
      });
    } else {
      res.status(503).json({
        status: 'error',
        service: 'db',
        message: dbStatus.error || 'Database connection failed',
      });
    }
  }

  public static async getRedisHealth(_req: Request, res: Response): Promise<void> {
    const redisStatus = await pingRedis();
    if (redisStatus.ok) {
      res.status(200).json({
        status: 'ok',
        service: 'redis',
        latencyMs: redisStatus.latencyMs,
      });
    } else {
      res.status(503).json({
        status: 'error',
        service: 'redis',
        message: redisStatus.error || 'Redis connection failed',
      });
    }
  }

  public static async getAiHealth(_req: Request, res: Response): Promise<void> {
    const aiStatus = await checkAiHealth();
    if (aiStatus.status === 'ok') {
      res.status(200).json({
        status: 'ok',
        service: 'ai',
        data: aiStatus.data,
      });
    } else {
      res.status(503).json({
        status: 'error',
        service: 'ai',
        message: aiStatus.error || 'AI service connection failed',
      });
    }
  }

  public static async getAllHealth(_req: Request, res: Response): Promise<void> {
    const [dbResult, redisResult, aiResult] = await Promise.all([
      testDbConnection(),
      pingRedis(),
      checkAiHealth(),
    ]);

    const apiStatus = { status: 'ok', service: 'api' };
    const dbStatus = dbResult.ok
      ? { status: 'ok', service: 'db', latencyMs: dbResult.latencyMs }
      : { status: 'error', service: 'db', message: dbResult.error };

    const redisStatus = redisResult.ok
      ? { status: 'ok', service: 'redis', latencyMs: redisResult.latencyMs }
      : { status: 'error', service: 'redis', message: redisResult.error };

    const aiStatusFormatted = aiResult.status === 'ok'
      ? { status: 'ok', service: 'ai', data: aiResult.data }
      : { status: 'error', service: 'ai', message: aiResult.error };

    const allOk = dbResult.ok && redisResult.ok && aiResult.status === 'ok';

    res.status(allOk ? 200 : 207).json({
      status: allOk ? 'ok' : 'degraded',
      services: {
        api: apiStatus,
        db: dbStatus,
        redis: redisStatus,
        ai: aiStatusFormatted,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
