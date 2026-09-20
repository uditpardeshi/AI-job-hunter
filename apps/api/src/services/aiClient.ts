import { config } from '../config';
import { logger } from '../utils/logger';

export interface AiServiceHealth {
  status: 'ok' | 'error';
  service: string;
  data?: unknown;
  error?: string;
}

export async function checkAiHealth(): Promise<AiServiceHealth> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/health`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        status: 'ok',
        service: 'ai',
        data,
      };
    } else {
      return {
        status: 'error',
        service: 'ai',
        error: `AI service returned HTTP ${response.status}`,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown AI service error';
    logger.error(`AI service connection failed at ${targetUrl}:`, errorMsg);
    return {
      status: 'error',
      service: 'ai',
      error: errorMsg,
    };
  }
}
