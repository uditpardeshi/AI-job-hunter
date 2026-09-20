import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 100, 1000);
  },
});

redis.on('error', (err) => {
  logger.error('Redis client error:', err.message);
});

export async function pingRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    if (redis.status !== 'ready') {
      await redis.connect().catch((err) => {
        // Ignored here if already connecting
      });
    }
    const pong = await redis.ping();
    const latencyMs = Date.now() - start;
    if (pong === 'PONG') {
      return { ok: true, latencyMs };
    }
    return { ok: false, error: `Unexpected response: ${pong}` };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown Redis error';
    logger.error('Redis ping failed:', errorMsg);
    return { ok: false, error: errorMsg };
  }
}
