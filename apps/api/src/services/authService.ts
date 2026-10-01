import crypto from 'crypto';
import { pool } from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface UserSession {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthResult {
  user: UserSession;
  token: string;
}

export class PasswordHasher {
  /**
   * Hash a plaintext password using crypto.scrypt with a random 16-byte salt
   */
  public static async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derived) => {
        if (err) reject(err);
        else resolve(derived);
      });
    });
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  /**
   * Verify password against salt:derivedKey hash using timing-safe comparison
   */
  public static async verify(password: string, combinedHash: string): Promise<boolean> {
    const parts = combinedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, 'hex');

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derived) => {
        if (err) reject(err);
        else resolve(derived);
      });
    });

    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }
}

export class TokenService {
  private static base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private static base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Sign an HS256 JWT
   */
  public static sign(payload: Record<string, any>, expiresInSeconds: number = 7 * 24 * 60 * 60): string {
    const secret = config.jwtSecret;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured.');
    }

    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${dataToSign}.${signature}`;
  }

  /**
   * Verify an HS256 JWT and return its payload
   */
  public static verify(token: string): Record<string, any> | null {
    try {
      const secret = config.jwtSecret;
      if (!secret) return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, signature] = parts;
      const dataToSign = `${encodedHeader}.${encodedPayload}`;

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(dataToSign)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSignature);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return null;
      }

      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}

export class AuthService {
  /**
   * Register a new user with email and password
   */
  public static async register(email: string, password: string, name?: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      const err: any = new Error('Valid email address is required');
      err.statusCode = 400;
      throw err;
    }

    if (!password || password.length < 8) {
      const err: any = new Error('Password must be at least 8 characters long');
      err.statusCode = 400;
      throw err;
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      const err: any = new Error('A user with this email address already exists');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await PasswordHasher.hash(password);
    const insertRes = await pool.query(
      `INSERT INTO users (email, name, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, email, name`,
      [cleanEmail, name ? name.trim() : null, passwordHash]
    );

    const userRow = insertRes.rows[0];
    const user: UserSession = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
    };

    const token = TokenService.sign({ userId: user.id, email: user.email });
    return { user, token };
  }

  /**
   * Log in with email and password
   */
  public static async login(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      const err: any = new Error('Email and password are required');
      err.statusCode = 400;
      throw err;
    }

    const res = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (res.rows.length === 0) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const userRow = res.rows[0];
    if (!userRow.password_hash) {
      const err: any = new Error('Password authentication not configured for this account. Please reset password or register.');
      err.statusCode = 401;
      throw err;
    }

    const isValid = await PasswordHasher.verify(password, userRow.password_hash);
    if (!isValid) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const user: UserSession = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
    };

    const token = TokenService.sign({ userId: user.id, email: user.email });
    return { user, token };
  }

  /**
   * Get user session profile by ID
   */
  public static async getUserById(userId: string): Promise<UserSession | null> {
    const res = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
    };
  }
}
