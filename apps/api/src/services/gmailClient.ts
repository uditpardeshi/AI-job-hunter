import https from 'https';
import http from 'http';
import { logger } from '../utils/logger';

export interface GmailTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
}

export interface RawGmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  headers: Record<string, string>;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: Date;
}

export class GmailClient {
  private static readonly GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
  private static readonly GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  private static readonly GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

  public static readonly REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  public static isMockMode(): boolean {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    return !clientId || clientId === 'mock' || clientId.includes('placeholder') || clientId === 'your-google-client-id';
  }

  /**
   * Generate Google OAuth 2.0 Authorization URL
   */
  public static getAuthUrl(state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'mock_client_id';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/integrations/gmail/callback';

    if (this.isMockMode()) {
      return `/api/integrations/gmail/callback?code=mock_auth_code_${Date.now()}&state=${encodeURIComponent(state)}`;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.REQUIRED_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${this.GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  /**
   * Exchange OAuth authorization code for Access & Refresh Tokens
   */
  public static async exchangeCodeForTokens(code: string): Promise<GmailTokens> {
    if (this.isMockMode() || code.startsWith('mock_auth_code')) {
      logger.info('Using Mock Gmail token exchange');
      return {
        accessToken: `mock_access_token_${Date.now()}`,
        refreshToken: `mock_refresh_token_${Date.now()}`,
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: this.REQUIRED_SCOPES.join(' '),
      };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/integrations/gmail/callback';

    const postData = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString();

    const response = await this.httpsPost(this.GOOGLE_TOKEN_ENDPOINT, postData, {
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    if (response.error) {
      throw new Error(`Google OAuth error: ${response.error_description || response.error}`);
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresIn: response.expires_in || 3600,
      tokenType: response.token_type || 'Bearer',
      scope: response.scope || this.REQUIRED_SCOPES.join(' '),
    };
  }

  /**
   * Refresh expired access token using stored refresh token
   */
  public static async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    if (this.isMockMode() || refreshToken.startsWith('mock_refresh_token')) {
      return {
        accessToken: `mock_access_token_${Date.now()}`,
        expiresIn: 3600,
      };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

    const postData = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString();

    const response = await this.httpsPost(this.GOOGLE_TOKEN_ENDPOINT, postData, {
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    if (response.error) {
      throw new Error(`Token refresh failed: ${response.error_description || response.error}`);
    }

    return {
      accessToken: response.access_token,
      expiresIn: response.expires_in || 3600,
    };
  }

  /**
   * Fetch user Gmail profile info (email address)
   */
  public static async getUserProfile(accessToken: string): Promise<GmailProfile> {
    if (this.isMockMode() || accessToken.startsWith('mock_access_token')) {
      return {
        emailAddress: process.env.CANDIDATE_EMAIL || 'alex.rivera@example.com',
        messagesTotal: 42,
        threadsTotal: 18,
      };
    }

    const res = await this.httpsGet(`${this.GMAIL_API_BASE}/profile`, {
      Authorization: `Bearer ${accessToken}`,
    });

    return {
      emailAddress: res.emailAddress,
      messagesTotal: res.messagesTotal,
      threadsTotal: res.threadsTotal,
    };
  }

  /**
   * Search job-related messages from user inbox
   */
  public static async searchMessages(
    accessToken: string,
    query: string = 'job OR interview OR application OR recruiter OR offer',
    maxResults: number = 20
  ): Promise<string[]> {
    if (this.isMockMode() || accessToken.startsWith('mock_access_token')) {
      return [
        'mock-msg-interview-001',
        'mock-msg-offer-002',
        'mock-msg-rejection-003',
        'mock-msg-inquiry-004',
      ];
    }

    const url = `${this.GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const res = await this.httpsGet(url, {
      Authorization: `Bearer ${accessToken}`,
    });

    if (!res.messages || !Array.isArray(res.messages)) {
      return [];
    }

    return res.messages.map((m: any) => m.id);
  }

  /**
   * Retrieve full details of a specific Gmail message
   */
  public static async getMessage(accessToken: string, messageId: string): Promise<RawGmailMessage> {
    if (this.isMockMode() || messageId.startsWith('mock-msg')) {
      return this.getMockMessage(messageId);
    }

    const url = `${this.GMAIL_API_BASE}/messages/${messageId}?format=full`;
    const res = await this.httpsGet(url, {
      Authorization: `Bearer ${accessToken}`,
    });

    const headers: Record<string, string> = {};
    if (res.payload && res.payload.headers) {
      for (const h of res.payload.headers) {
        headers[h.name.toLowerCase()] = h.value;
      }
    }

    const { bodyText, bodyHtml } = this.extractBodyParts(res.payload);
    const internalDate = res.internalDate ? new Date(Number(res.internalDate)) : new Date();

    return {
      id: res.id,
      threadId: res.threadId,
      labelIds: res.labelIds || [],
      snippet: res.snippet || '',
      headers,
      bodyText,
      bodyHtml,
      receivedAt: internalDate,
    };
  }

  /**
   * Send RFC 2822 MIME formatted message via Gmail API
   */
  public static async sendMessage(
    accessToken: string,
    rawMimeBase64Url: string,
    threadId?: string
  ): Promise<{ id: string; threadId: string }> {
    if (this.isMockMode() || accessToken.startsWith('mock_access_token')) {
      logger.info('Simulated email send in Mock Gmail mode');
      return {
        id: `mock-sent-${Date.now()}`,
        threadId: threadId || `mock-thread-${Date.now()}`,
      };
    }

    const bodyObj: any = { raw: rawMimeBase64Url };
    if (threadId) bodyObj.threadId = threadId;

    const res = await this.httpsPost(
      `${this.GMAIL_API_BASE}/messages/send`,
      JSON.stringify(bodyObj),
      {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    );

    return {
      id: res.id,
      threadId: res.threadId,
    };
  }

  /**
   * Construct RFC 2822 base64url-encoded MIME message with attachments
   */
  public static createMimeMessage(options: {
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    bodyText: string;
    attachments?: Array<{ filename: string; contentType: string; dataBuffer: Buffer }>;
  }): string {
    const boundary = `====_ai_job_hunter_boundary_${Date.now()}_====`;
    const toHeader = options.to.join(', ');
    const ccHeader = options.cc && options.cc.length > 0 ? `Cc: ${options.cc.join(', ')}\r\n` : '';

    let raw = '';
    raw += `From: ${options.from}\r\n`;
    raw += `To: ${toHeader}\r\n`;
    if (ccHeader) raw += ccHeader;
    raw += `Subject: =?UTF-8?B?${Buffer.from(options.subject, 'utf-8').toString('base64')}?=\r\n`;
    raw += `MIME-Version: 1.0\r\n`;

    if (options.attachments && options.attachments.length > 0) {
      raw += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      raw += `--${boundary}\r\n`;
      raw += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      raw += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
      raw += `${options.bodyText}\r\n\r\n`;

      for (const att of options.attachments) {
        raw += `--${boundary}\r\n`;
        raw += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
        raw += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
        raw += `Content-Transfer-Encoding: base64\r\n\r\n`;
        raw += `${att.dataBuffer.toString('base64')}\r\n\r\n`;
      }

      raw += `--${boundary}--\r\n`;
    } else {
      raw += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      raw += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
      raw += `${options.bodyText}\r\n`;
    }

    // Return base64url encoded
    return Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // --- Internal Helpers ---

  private static extractBodyParts(payload: any): { bodyText: string; bodyHtml?: string } {
    let bodyText = '';
    let bodyHtml: string | undefined = undefined;

    if (!payload) return { bodyText };

    const decodeData = (dataStr?: string) => {
      if (!dataStr) return '';
      return Buffer.from(dataStr.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    };

    if (payload.body && payload.body.data) {
      bodyText = decodeData(payload.body.data);
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          bodyText = decodeData(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
          bodyHtml = decodeData(part.body.data);
        }
      }
    }

    return { bodyText, bodyHtml };
  }

  private static getMockMessage(id: string): RawGmailMessage {
    const now = new Date();
    switch (id) {
      case 'mock-msg-interview-001':
        return {
          id: 'mock-msg-interview-001',
          threadId: 'mock-thread-101',
          snippet: 'Invitation to Technical Interview: Senior Backend Engineer at Acme Corp',
          headers: {
            from: 'Sarah Jenkins <sarah.jenkins@acmecorp.com>',
            to: 'alex.rivera@example.com',
            subject: 'Interview Invitation: Senior Backend Engineer - Acme Corp',
            date: new Date(now.getTime() - 3600000 * 2).toUTCString(),
          },
          bodyText: `Hi Alex,\n\nThank you for applying for the Senior Backend Engineer position at Acme Corp. We were very impressed by your background in Node.js, TypeScript, and distributed systems.\n\nWe would love to invite you to a 45-minute technical screen next week. Please let us know your availability for Tuesday or Wednesday.\n\nBest regards,\nSarah Jenkins\nSenior Technical Recruiter | Acme Corp`,
          receivedAt: new Date(now.getTime() - 3600000 * 2),
        };

      case 'mock-msg-offer-002':
        return {
          id: 'mock-msg-offer-002',
          threadId: 'mock-thread-102',
          snippet: 'Formal Job Offer: Lead Developer at CloudScale Systems',
          headers: {
            from: 'Marcus Vance <m.vance@cloudscale.io>',
            to: 'alex.rivera@example.com',
            subject: 'Offer of Employment: Lead Developer - CloudScale Systems',
            date: new Date(now.getTime() - 3600000 * 24).toUTCString(),
          },
          bodyText: `Dear Alex,\n\nOn behalf of CloudScale Systems, I am thrilled to extend an offer for the Lead Developer role. We are excited about the prospect of having you join our team.\n\nPlease find the offer letter attached for your review. We would appreciate your response by next Friday.\n\nWarm regards,\nMarcus Vance\nHead of Talent | CloudScale Systems`,
          receivedAt: new Date(now.getTime() - 3600000 * 24),
        };

      case 'mock-msg-rejection-003':
        return {
          id: 'mock-msg-rejection-003',
          threadId: 'mock-thread-103',
          snippet: 'Update on your application for Staff Architect at Quantum AI',
          headers: {
            from: 'Quantum Talent Team <careers@quantumai.tech>',
            to: 'alex.rivera@example.com',
            subject: 'Your Application with Quantum AI',
            date: new Date(now.getTime() - 3600000 * 48).toUTCString(),
          },
          bodyText: `Hi Alex,\n\nThank you for your interest in the Staff Architect role at Quantum AI. Although your qualifications were impressive, we have decided to move forward with other candidates whose experience more closely aligns with our current requirements.\n\nWe wish you the best in your job search.\n\nSincerely,\nQuantum AI Talent Team`,
          receivedAt: new Date(now.getTime() - 3600000 * 48),
        };

      default:
        return {
          id: 'mock-msg-inquiry-004',
          threadId: 'mock-thread-104',
          snippet: 'Opportunity: Full Stack Developer at Swissbit',
          headers: {
            from: 'Daniel Hofer <d.hofer@swissbit.com>',
            to: 'alex.rivera@example.com',
            subject: 'Swissbit - Application Follow-up regarding Semiconductor Packaging role',
            date: new Date(now.getTime() - 3600000 * 5).toUTCString(),
          },
          bodyText: `Hello Alex,\n\nI came across your profile and recent application regarding our engineering vacancy at Swissbit. We are currently reviewing shortlists and wanted to confirm if you are still actively exploring new opportunities?\n\nLooking forward to hearing from you.\n\nBest,\nDaniel Hofer\nTalent Acquisition | Swissbit`,
          receivedAt: new Date(now.getTime() - 3600000 * 5),
        };
    }
  }

  private static httpsGet(urlStr: string, headers: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'GET',
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks).toString('utf-8');
            try {
              resolve(JSON.parse(buf));
            } catch {
              resolve(buf);
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  private static httpsPost(urlStr: string, body: string, headers: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            ...headers,
            'Content-Length': Buffer.byteLength(body).toString(),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks).toString('utf-8');
            try {
              resolve(JSON.parse(buf));
            } catch {
              resolve(buf);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
