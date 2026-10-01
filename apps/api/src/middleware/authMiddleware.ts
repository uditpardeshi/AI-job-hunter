import { Request, Response, NextFunction } from 'express';
import { TokenService, AuthService, UserSession } from '../services/authService';

declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}

function parseCookie(cookieHeader?: string, name: string = 'auth_token'): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function extractAuthToken(req: Request): string | null {
  // 1. Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Check Cookie: auth_token=<token>
  const cookieToken = parseCookie(req.headers.cookie, 'auth_token');
  if (cookieToken) {
    return cookieToken.trim();
  }

  return null;
}

/**
 * Middleware: Strictly requires authenticated user via Bearer token or HTTP-only auth_token cookie.
 * Never falls back to hardcoded user or x-user-id header.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractAuthToken(req);
  if (!token) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required. Please log in.',
    });
    return;
  }

  const payload = TokenService.verify(token);
  if (!payload || !payload.userId) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired authentication token. Please log in again.',
    });
    return;
  }

  const user = await AuthService.getUserById(payload.userId);
  if (!user) {
    res.status(401).json({
      status: 'error',
      message: 'User account not found. Please log in again.',
    });
    return;
  }

  req.user = user;
  next();
}

/**
 * Middleware: Optionally attaches authenticated user context if valid token present.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractAuthToken(req);
  if (token) {
    const payload = TokenService.verify(token);
    if (payload && payload.userId) {
      const user = await AuthService.getUserById(payload.userId);
      if (user) {
        req.user = user;
      }
    }
  }
  next();
}
