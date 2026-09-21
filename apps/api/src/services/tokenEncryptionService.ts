import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const DEFAULT_SECRET = 'ai-job-hunter-secret-encryption-key-dev-fallback';

export class TokenEncryptionService {
  private static getKey(): Buffer {
    const secret = process.env.ENCRYPTION_SECRET || DEFAULT_SECRET;
    // Derive a clean 32-byte key using SHA-256
    return crypto.createHash('sha256').update(secret).digest();
  }

  /**
   * Encrypt a plaintext token (access or refresh token).
   * Format: ivHex:authTagHex:encryptedHex
   */
  public static encrypt(plainText: string): string {
    if (!plainText) return plainText;

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt an encrypted token.
   * Expects format: ivHex:authTagHex:encryptedHex
   */
  public static decrypt(cipherText: string): string {
    if (!cipherText) return cipherText;

    // Check if format matches iv:tag:encrypted
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      // If it's legacy unencrypted or different format, return as-is for resilience
      return cipherText;
    }

    try {
      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = this.getKey();

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err) {
      throw new Error('Failed to decrypt token: Invalid key or corrupted payload');
    }
  }
}
