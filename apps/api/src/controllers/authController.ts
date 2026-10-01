import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { config } from '../config';

const COOKIE_NAME = 'auth_token';

function setAuthCookie(res: Response, token: string): void {
  const isProd = config.env === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    path: '/',
  });
}

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body || {};
      const result = await AuthService.register(email, password, name);
      setAuthCookie(res, result.token);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Account created successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body || {};
      const result = await AuthService.login(email, password);
      setAuthCookie(res, result.token);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Logged in successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      clearAuthCookie(res);
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
