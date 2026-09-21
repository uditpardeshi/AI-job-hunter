import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { EmailService } from '../services/emailService';
import { GmailClient } from '../services/gmailClient';
import { DEFAULT_USER_ID } from '../db/migrations';
import { logger } from '../utils/logger';

// Ephemeral in-memory CSRF state cache (valid for 15 minutes)
const oauthStateStore = new Map<string, { userId: string; createdAt: number }>();

export class GmailController {
  public static async getConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const connection = await EmailService.getGmailConnection(userId);

      res.status(200).json({
        success: true,
        data: connection,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getConnectUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const state = crypto.randomBytes(24).toString('hex');

      // Store CSRF state
      oauthStateStore.set(state, { userId, createdAt: Date.now() });

      // Expire old states
      const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
      for (const [key, val] of oauthStateStore.entries()) {
        if (val.createdAt < fifteenMinsAgo) {
          oauthStateStore.delete(key);
        }
      }

      const authUrl = GmailClient.getAuthUrl(state);

      res.status(200).json({
        success: true,
        data: {
          authUrl,
          state,
          isMock: GmailClient.isMockMode(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async handleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

      if (error) {
        logger.warn(`Google OAuth denied or returned error: ${error}`);
        res.status(400).json({
          success: false,
          error: `Google authorization denied: ${error}`,
        });
        return;
      }

      if (!code || !state) {
        res.status(400).json({
          success: false,
          error: 'Missing required OAuth parameters: code or state',
        });
        return;
      }

      // Verify CSRF state
      const stored = oauthStateStore.get(state);
      const isMock = GmailClient.isMockMode() || code.startsWith('mock_auth_code');

      let userId = DEFAULT_USER_ID;
      if (stored) {
        userId = stored.userId;
        oauthStateStore.delete(state);
      } else if (!isMock) {
        res.status(403).json({
          success: false,
          error: 'Invalid or expired OAuth state parameter',
        });
        return;
      }

      // Exchange authorization code for tokens
      const tokens = await GmailClient.exchangeCodeForTokens(code);

      // Fetch user profile email
      const profile = await GmailClient.getUserProfile(tokens.accessToken);

      // Save connection securely with encrypted tokens
      const connection = await EmailService.saveGmailConnection(userId, {
        emailAddress: profile.emailAddress,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        scopes: tokens.scope.split(' '),
      });

      // If requested by a browser navigation, redirect to integrations settings page
      const acceptHeader = req.headers['accept'] || '';
      if (acceptHeader.includes('text/html')) {
        const webBase = process.env.CORS_ORIGIN || 'http://localhost:3000';
        res.redirect(`${webBase}/settings/integrations?connected=true`);
        return;
      }

      res.status(200).json({
        success: true,
        data: connection,
        message: 'Gmail successfully connected',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      await EmailService.disconnectGmail(userId);

      res.status(200).json({
        success: true,
        message: 'Gmail disconnected successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const connection = await EmailService.getGmailConnection(userId);

      if (!connection) {
        res.status(400).json({
          success: false,
          error: 'Gmail is not connected. Please connect Gmail in Settings > Integrations first.',
        });
        return;
      }

      const result = await EmailService.syncEmails(userId);

      res.status(200).json({
        success: true,
        data: result,
        message: `Synced ${result.syncedCount} emails (${result.newCount} new)`,
      });
    } catch (err) {
      next(err);
    }
  }
}
