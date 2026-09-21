import fs from 'fs';
import path from 'path';
import { pool } from '../db';
import { logger } from '../utils/logger';
import { TokenEncryptionService } from './tokenEncryptionService';
import { GmailClient } from './gmailClient';
import { classifyEmailWithAi, generateEmailWithAi, exportDocumentWithAi } from './aiClient';
import { ApplicationService } from './applicationService';
import {
  EmailMessage,
  EmailCategory,
  EmailDirection,
  EmailDraft,
  EmailAttachment,
  ApplicationContact,
  EmailSearchParams,
  GmailConnection,
  SendEmailRequest,
  ApplicationStatus,
} from '@ai-job-hunter/shared';

export class EmailService {
  // ----------------------------------------------------
  // 1. Gmail Connection Management
  // ----------------------------------------------------

  public static async getGmailConnection(userId: string): Promise<GmailConnection | null> {
    const res = await pool.query(
      `SELECT id, user_id, candidate_id, email_address, scopes, is_connected, last_synced_at, created_at, updated_at
       FROM gmail_connections
       WHERE user_id = $1 AND is_connected = true LIMIT 1;`,
      [userId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      candidateId: row.candidate_id,
      emailAddress: row.email_address,
      scopes: row.scopes || [],
      isConnected: row.is_connected,
      lastSyncedAt: row.last_synced_at?.toISOString() || null,
      createdAt: row.created_at?.toISOString() || row.created_at,
      updatedAt: row.updated_at?.toISOString() || row.updated_at,
    };
  }

  public static async saveGmailConnection(
    userId: string,
    data: {
      emailAddress: string;
      accessToken: string;
      refreshToken?: string;
      expiresIn: number;
      scopes: string[];
    }
  ): Promise<GmailConnection> {
    const candidateRes = await pool.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const candidateId = candidateRes.rows.length > 0 ? candidateRes.rows[0].id : null;

    const encryptedAccessToken = TokenEncryptionService.encrypt(data.accessToken);
    const encryptedRefreshToken = data.refreshToken
      ? TokenEncryptionService.encrypt(data.refreshToken)
      : null;

    const expiresAt = new Date(Date.now() + data.expiresIn * 1000);

    const res = await pool.query(
      `
      INSERT INTO gmail_connections (
        user_id, candidate_id, email_address, access_token, refresh_token,
        token_expires_at, scopes, is_connected, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        email_address = EXCLUDED.email_address,
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, gmail_connections.refresh_token),
        token_expires_at = EXCLUDED.token_expires_at,
        scopes = EXCLUDED.scopes,
        is_connected = true,
        updated_at = NOW()
      RETURNING id, user_id, candidate_id, email_address, scopes, is_connected, last_synced_at, created_at, updated_at;
      `,
      [
        userId,
        candidateId,
        data.emailAddress,
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        data.scopes,
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      candidateId: row.candidate_id,
      emailAddress: row.email_address,
      scopes: row.scopes || [],
      isConnected: row.is_connected,
      lastSyncedAt: row.last_synced_at?.toISOString() || null,
      createdAt: row.created_at?.toISOString() || row.created_at,
      updatedAt: row.updated_at?.toISOString() || row.updated_at,
    };
  }

  public static async disconnectGmail(userId: string): Promise<boolean> {
    const res = await pool.query(
      `
      UPDATE gmail_connections
      SET is_connected = false,
          access_token = '',
          refresh_token = NULL,
          updated_at = NOW()
      WHERE user_id = $1;
      `,
      [userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  public static async getDecryptedTokens(userId: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const res = await pool.query(
      `SELECT access_token, refresh_token, token_expires_at
       FROM gmail_connections
       WHERE user_id = $1 AND is_connected = true LIMIT 1;`,
      [userId]
    );

    if (res.rows.length === 0) {
      throw new Error('Gmail account is not connected');
    }

    const { access_token, refresh_token, token_expires_at } = res.rows[0];
    let accessToken = TokenEncryptionService.decrypt(access_token);
    const refreshToken = refresh_token ? TokenEncryptionService.decrypt(refresh_token) : undefined;

    // Auto-refresh if token is near expiration (< 2 minutes left)
    const expiresAt = new Date(token_expires_at).getTime();
    if (refreshToken && Date.now() > expiresAt - 120000) {
      try {
        const refreshed = await GmailClient.refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
        await pool.query(
          `UPDATE gmail_connections
           SET access_token = $1, token_expires_at = $2, updated_at = NOW()
           WHERE user_id = $3`,
          [TokenEncryptionService.encrypt(accessToken), newExpiresAt, userId]
        );
      } catch (err: any) {
        logger.warn(`Failed to refresh token: ${err.message}`);
      }
    }

    return { accessToken, refreshToken };
  }

  // ----------------------------------------------------
  // 2. Email Synchronization & Idempotency
  // ----------------------------------------------------

  public static async syncEmails(userId: string): Promise<{
    syncedCount: number;
    messages: EmailMessage[];
    newCount: number;
  }> {
    const { accessToken } = await this.getDecryptedTokens(userId);

    const messageIds = await GmailClient.searchMessages(
      accessToken,
      'job OR interview OR application OR recruiter OR offer OR assessment',
      25
    );

    let newCount = 0;
    const syncedMessages: EmailMessage[] = [];

    for (const msgId of messageIds) {
      // Idempotency check: verify if already synced
      const existingRes = await pool.query(
        'SELECT id FROM emails WHERE user_id = $1 AND gmail_message_id = $2 LIMIT 1;',
        [userId, msgId]
      );

      if (existingRes.rows.length > 0) {
        const existing = await this.getEmailById(existingRes.rows[0].id, userId);
        if (existing) syncedMessages.push(existing);
        continue;
      }

      // Fetch message details
      const rawMsg = await GmailClient.getMessage(accessToken, msgId);

      const sender = rawMsg.headers['from'] || 'Unknown Sender';
      const recipient = rawMsg.headers['to'] || 'Unknown Recipient';
      const subject = rawMsg.headers['subject'] || '(No Subject)';
      const snippet = rawMsg.snippet || '';
      const bodyText = rawMsg.bodyText || snippet;
      const bodyHtml = rawMsg.bodyHtml || null;

      // Extract sender email and name
      const emailMatch = sender.match(/<([^>]+)>/) || [null, sender];
      const senderEmail = (emailMatch[1] || sender).trim().toLowerCase();
      const senderName = sender.split('<')[0].trim().replace(/^"|"$/g, '') || senderEmail;

      // AI Classification
      let classification: any = {
        category: 'OTHER',
        confidence: 0.7,
        requiresResponse: false,
      };

      try {
        classification = await classifyEmailWithAi({
          subject,
          sender,
          body: bodyText,
          snippet,
        });
      } catch (err: any) {
        logger.warn(`AI classification fallback used: ${err.message}`);
      }

      // Attempt matching with existing applications
      const matchedApp = await this.matchEmailToApplication(userId, {
        senderEmail,
        company: classification.company,
        jobTitle: classification.jobTitle,
        subject,
      });

      const applicationId = matchedApp ? matchedApp.id : null;

      // Insert into emails table
      const insertRes = await pool.query(
        `
        INSERT INTO emails (
          user_id, application_id, gmail_message_id, thread_id,
          sender, sender_email, sender_name, recipient, cc,
          subject, snippet, body_text, body_html, direction,
          category, confidence, suggested_status, requires_response,
          received_at, is_read, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          'INBOUND', $14, $15, $16, $17, $18, false, NOW(), NOW()
        )
        ON CONFLICT (user_id, gmail_message_id) DO UPDATE SET
          updated_at = NOW()
        RETURNING *;
        `,
        [
          userId,
          applicationId,
          rawMsg.id,
          rawMsg.threadId || null,
          sender,
          senderEmail,
          senderName,
          recipient,
          rawMsg.headers['cc'] ? rawMsg.headers['cc'].split(',').map((s) => s.trim()) : [],
          subject,
          snippet,
          bodyText,
          bodyHtml,
          classification.category || 'OTHER',
          classification.confidence || 0.8,
          classification.suggestedStatus || null,
          classification.requiresResponse ?? false,
          rawMsg.receivedAt,
        ]
      );

      const emailRow = insertRes.rows[0];
      newCount++;

      // If associated with an application, create an immutable timeline event
      if (applicationId) {
        await pool.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            applicationId,
            'APPLICATION_EMAIL_RECEIVED',
            `Received email from ${senderName}: "${subject}"`,
            JSON.stringify({
              emailId: emailRow.id,
              gmailMessageId: rawMsg.id,
              category: classification.category,
              suggestedStatus: classification.suggestedStatus,
              senderEmail,
            }),
            rawMsg.receivedAt,
          ]
        );
      }

      const mapped = this.mapEmailRow(emailRow);
      syncedMessages.push(mapped);
    }

    // Update last_synced_at
    await pool.query(
      'UPDATE gmail_connections SET last_synced_at = NOW() WHERE user_id = $1',
      [userId]
    );

    return {
      syncedCount: syncedMessages.length,
      newCount,
      messages: syncedMessages,
    };
  }

  // ----------------------------------------------------
  // 3. Email-to-Application Matching
  // ----------------------------------------------------

  public static async matchEmailToApplication(
    userId: string,
    meta: {
      senderEmail?: string;
      company?: string | null;
      jobTitle?: string | null;
      subject?: string;
    }
  ): Promise<{ id: string; title: string; company: string } | null> {
    // Stage 1: Match by recruiter contact email
    if (meta.senderEmail) {
      const contactRes = await pool.query(
        `
        SELECT a.id, j.title, j.company
        FROM application_contacts ac
        JOIN applications a ON ac.application_id = a.id
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = $1 AND LOWER(ac.email) = LOWER($2) AND a.status != 'WITHDRAWN'
        LIMIT 1;
        `,
        [userId, meta.senderEmail]
      );
      if (contactRes.rows.length > 0) {
        return contactRes.rows[0];
      }
    }

    // Stage 2: Match by company name
    if (meta.company && meta.company.trim().length > 1) {
      const compRes = await pool.query(
        `
        SELECT a.id, j.title, j.company
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = $1 AND j.company ILIKE $2 AND a.status != 'WITHDRAWN'
        ORDER BY a.last_updated_at DESC
        LIMIT 2;
        `,
        [userId, `%${meta.company.trim()}%`]
      );

      if (compRes.rows.length === 1) {
        return compRes.rows[0];
      }
      if (compRes.rows.length > 1 && meta.jobTitle) {
        // Tie-break with job title
        for (const row of compRes.rows) {
          if (row.title.toLowerCase().includes(meta.jobTitle.toLowerCase())) {
            return row;
          }
        }
      }
    }

    // Stage 3: Match by subject keyword search
    if (meta.subject) {
      const subRes = await pool.query(
        `
        SELECT a.id, j.title, j.company
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = $1 
          AND a.status != 'WITHDRAWN'
          AND ($2 ILIKE '%' || j.company || '%' OR $2 ILIKE '%' || j.title || '%')
        ORDER BY a.last_updated_at DESC
        LIMIT 1;
        `,
        [userId, meta.subject]
      );
      if (subRes.rows.length > 0) {
        return subRes.rows[0];
      }
    }

    return null;
  }

  public static async associateEmailWithApplication(
    emailId: string,
    userId: string,
    applicationId: string
  ): Promise<EmailMessage> {
    // Verify application belongs to user
    const appRes = await pool.query(
      'SELECT id, job_id FROM applications WHERE id = $1 AND user_id = $2',
      [applicationId, userId]
    );
    if (appRes.rows.length === 0) {
      throw new Error('Application not found');
    }

    const emailRes = await pool.query(
      `
      UPDATE emails
      SET application_id = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *;
      `,
      [applicationId, emailId, userId]
    );

    if (emailRes.rows.length === 0) {
      throw new Error('Email not found');
    }

    const email = emailRes.rows[0];

    // Log timeline event if not already present
    const existingEvent = await pool.query(
      `SELECT id FROM application_events 
       WHERE application_id = $1 AND metadata->>'emailId' = $2 LIMIT 1`,
      [applicationId, emailId]
    );

    if (existingEvent.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO application_events (
          application_id, event_type, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5);
        `,
        [
          applicationId,
          'APPLICATION_EMAIL_RECEIVED',
          `Associated email: "${email.subject}" from ${email.sender_name || email.sender_email}`,
          JSON.stringify({
            emailId,
            gmailMessageId: email.gmail_message_id,
            category: email.category,
            suggestedStatus: email.suggested_status,
          }),
          email.received_at,
        ]
      );
    }

    return this.mapEmailRow(email);
  }

  // ----------------------------------------------------
  // 4. Status Suggestion Handling (Explicit User Action)
  // ----------------------------------------------------

  public static async handleStatusSuggestion(
    emailId: string,
    userId: string,
    action: 'accept' | 'ignore'
  ): Promise<{ success: boolean; newStatus?: ApplicationStatus }> {
    const emailRes = await pool.query(
      'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
      [emailId, userId]
    );
    if (emailRes.rows.length === 0) {
      throw new Error('Email not found');
    }

    const email = emailRes.rows[0];
    if (!email.application_id) {
      throw new Error('Email is not linked to any application');
    }

    if (action === 'accept' && email.suggested_status) {
      // Explicitly update application status
      await ApplicationService.updateStatus(
        email.application_id,
        userId,
        email.suggested_status as ApplicationStatus,
        `Status updated based on email: "${email.subject}"`
      );

      await pool.query(
        'UPDATE emails SET status_suggestion_handled = true, updated_at = NOW() WHERE id = $1',
        [emailId]
      );

      return { success: true, newStatus: email.suggested_status as ApplicationStatus };
    }

    // Ignore action
    await pool.query(
      'UPDATE emails SET status_suggestion_handled = true, updated_at = NOW() WHERE id = $1',
      [emailId]
    );

    return { success: true };
  }

  // ----------------------------------------------------
  // 5. Query Emails & Details
  // ----------------------------------------------------

  public static async listEmails(
    userId: string,
    params: EmailSearchParams
  ): Promise<{ emails: EmailMessage[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['e.user_id = $1'];
    const values: any[] = [userId];
    let valIdx = 2;

    if (params.category) {
      whereClauses.push(`e.category = $${valIdx++}`);
      values.push(params.category);
    }

    if (params.applicationId) {
      whereClauses.push(`e.application_id = $${valIdx++}`);
      values.push(params.applicationId);
    }

    if (params.direction) {
      whereClauses.push(`e.direction = $${valIdx++}`);
      values.push(params.direction);
    }

    if (params.isRead !== undefined) {
      whereClauses.push(`e.is_read = $${valIdx++}`);
      values.push(params.isRead);
    }

    if (params.requiresResponse !== undefined) {
      whereClauses.push(`e.requires_response = $${valIdx++}`);
      values.push(params.requiresResponse);
    }

    if (params.search) {
      whereClauses.push(
        `(e.subject ILIKE $${valIdx} OR e.sender ILIKE $${valIdx} OR e.snippet ILIKE $${valIdx} OR j.company ILIKE $${valIdx})`
      );
      values.push(`%${params.search}%`);
      valIdx++;
    }

    const whereSql = whereClauses.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total 
       FROM emails e
       LEFT JOIN applications a ON e.application_id = a.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE ${whereSql};`,
      values
    );
    const total = countRes.rows[0].total;

    const query = `
      SELECT e.*,
             j.id AS job_id, j.title AS job_title, j.company AS job_company,
             a.status AS app_status
      FROM emails e
      LEFT JOIN applications a ON e.application_id = a.id
      LEFT JOIN jobs j ON a.job_id = j.id
      WHERE ${whereSql}
      ORDER BY e.received_at DESC
      LIMIT $${valIdx++} OFFSET $${valIdx++};
    `;

    const res = await pool.query(query, [...values, limit, offset]);

    const emails = res.rows.map((row) => {
      const email = this.mapEmailRow(row);
      if (row.application_id && row.job_id) {
        email.application = {
          id: row.application_id,
          userId,
          jobId: row.job_id,
          status: row.app_status,
          job: {
            id: row.job_id,
            title: row.job_title,
            company: row.job_company,
          } as any,
        } as any;
      }
      return email;
    });

    return {
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public static async getEmailById(id: string, userId: string): Promise<EmailMessage | null> {
    const res = await pool.query(
      `
      SELECT e.*,
             j.id AS job_id, j.title AS job_title, j.company AS job_company,
             a.status AS app_status
      FROM emails e
      LEFT JOIN applications a ON e.application_id = a.id
      LEFT JOIN jobs j ON a.job_id = j.id
      WHERE e.id = $1 AND e.user_id = $2;
      `,
      [id, userId]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];

    // Mark email as read
    if (!row.is_read) {
      await pool.query('UPDATE emails SET is_read = true WHERE id = $1', [id]);
      row.is_read = true;
    }

    const email = this.mapEmailRow(row);
    if (row.application_id && row.job_id) {
      email.application = {
        id: row.application_id,
        userId,
        jobId: row.job_id,
        status: row.app_status,
        job: {
          id: row.job_id,
          title: row.job_title,
          company: row.job_company,
        } as any,
      } as any;
    }

    return email;
  }

  // ----------------------------------------------------
  // 6. Zero-Fabrication AI Email Drafting
  // ----------------------------------------------------

  public static async generateDraft(
    userId: string,
    req: {
      applicationId?: string;
      emailId?: string;
      purpose: string;
      tone?: string;
      userInstructions?: string;
    }
  ): Promise<{ subject: string; body: string; purpose: string; warnings: string[] }> {
    let jobTitle: string | null = null;
    let company: string | null = null;
    let emailContext: string | null = null;

    // Fetch verified candidate profile
    const profRes = await pool.query(
      'SELECT basics, skills, experience FROM candidate_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const candidateProfile = profRes.rows.length > 0 ? profRes.rows[0] : null;

    // If applicationId provided, get job info
    if (req.applicationId) {
      const appRes = await pool.query(
        `SELECT j.title, j.company 
         FROM applications a JOIN jobs j ON a.job_id = j.id 
         WHERE a.id = $1 AND a.user_id = $2`,
        [req.applicationId, userId]
      );
      if (appRes.rows.length > 0) {
        jobTitle = appRes.rows[0].title;
        company = appRes.rows[0].company;
      }
    }

    // If reply to email, extract subject and text
    if (req.emailId) {
      const emailRes = await pool.query(
        'SELECT subject, sender, body_text FROM emails WHERE id = $1 AND user_id = $2',
        [req.emailId, userId]
      );
      if (emailRes.rows.length > 0) {
        const e = emailRes.rows[0];
        emailContext = `From: ${e.sender}\nSubject: ${e.subject}\n\n${e.body_text || ''}`;
      }
    }

    return await generateEmailWithAi({
      candidateProfile,
      jobTitle,
      company,
      purpose: req.purpose,
      tone: req.tone || 'professional',
      emailContext,
      userInstructions: req.userInstructions,
    });
  }

  public static async saveDraft(
    userId: string,
    draftData: Partial<EmailDraft>
  ): Promise<EmailDraft> {
    const res = await pool.query(
      `
      INSERT INTO email_drafts (
        user_id, application_id, reply_to_email_id, purpose, tone,
        recipient, cc, subject, body, attachments, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT', NOW(), NOW())
      RETURNING *;
      `,
      [
        userId,
        draftData.applicationId || null,
        draftData.replyToEmailId || null,
        draftData.purpose || 'APPLICATION_FOLLOW_UP',
        draftData.tone || 'professional',
        draftData.recipient || '',
        draftData.cc || [],
        draftData.subject || '',
        draftData.body || '',
        JSON.stringify(draftData.attachments || []),
      ]
    );

    return this.mapDraftRow(res.rows[0]);
  }

  public static async listDrafts(userId: string, applicationId?: string): Promise<EmailDraft[]> {
    const whereClauses = ['user_id = $1', "status != 'DISCARDED'"];
    const values: any[] = [userId];

    if (applicationId) {
      whereClauses.push('application_id = $2');
      values.push(applicationId);
    }

    const res = await pool.query(
      `SELECT * FROM email_drafts WHERE ${whereClauses.join(' AND ')} ORDER BY updated_at DESC;`,
      values
    );

    return res.rows.map(this.mapDraftRow);
  }

  // ----------------------------------------------------
  // 7. Controlled Gmail Sending (Explicit User Action Only)
  // ----------------------------------------------------

  public static async sendEmail(
    userId: string,
    req: SendEmailRequest
  ): Promise<{ success: boolean; messageId: string; threadId: string }> {
    // 1. Validate inputs
    if (!req.to || req.to.length === 0 || !req.to.every((e) => e.includes('@'))) {
      throw new Error('Valid recipient email address is required');
    }
    if (!req.subject || !req.subject.trim()) {
      throw new Error('Email subject cannot be empty');
    }
    if (!req.body || !req.body.trim()) {
      throw new Error('Email body cannot be empty');
    }

    // 2. Fetch connected Gmail tokens
    const { accessToken } = await this.getDecryptedTokens(userId);
    const profile = await GmailClient.getUserProfile(accessToken);
    const fromAddress = profile.emailAddress;

    // 3. Resolve and validate attachments
    const preparedAttachments: Array<{ filename: string; contentType: string; dataBuffer: Buffer }> = [];

    if (req.attachments && req.attachments.length > 0) {
      for (const att of req.attachments) {
        let buffer: Buffer | null = null;
        let filename = att.name || 'attachment.pdf';
        let contentType = att.type || 'application/pdf';

        if (att.sourceType === 'tailored_resume' && att.sourceId) {
          const trRes = await pool.query(
            'SELECT resume_data FROM tailored_resumes WHERE id = $1 AND user_id = $2',
            [att.sourceId, userId]
          );
          if (trRes.rows.length > 0) {
            buffer = await exportDocumentWithAi('export/pdf', trRes.rows[0].resume_data);
            filename = `${filename.replace(/\.[^/.]+$/, '')}.pdf`;
            contentType = 'application/pdf';
          }
        } else if (att.sourceType === 'cover_letter' && att.sourceId) {
          const clRes = await pool.query(
            'SELECT content, target_role, target_company FROM cover_letters WHERE id = $1 AND user_id = $2',
            [att.sourceId, userId]
          );
          if (clRes.rows.length > 0) {
            buffer = await exportDocumentWithAi('export/cover-letter/pdf', {
              coverLetter: clRes.rows[0],
              candidateProfile: {},
            });
            filename = `${filename.replace(/\.[^/.]+$/, '')}.pdf`;
            contentType = 'application/pdf';
          }
        } else if (att.sourceType === 'base_resume' && att.sourceId) {
          const bRes = await pool.query(
            'SELECT storage_path, original_filename, file_type FROM resumes WHERE id = $1 AND user_id = $2',
            [att.sourceId, userId]
          );
          if (bRes.rows.length > 0 && fs.existsSync(bRes.rows[0].storage_path)) {
            buffer = fs.readFileSync(bRes.rows[0].storage_path);
            filename = bRes.rows[0].original_filename;
            contentType = bRes.rows[0].file_type === 'pdf' ? 'application/pdf' : 'application/octet-stream';
          }
        }

        if (buffer) {
          preparedAttachments.push({ filename, contentType, dataBuffer: buffer });
        }
      }
    }

    // 4. Build RFC 2822 MIME message
    const mimeBase64Url = GmailClient.createMimeMessage({
      from: fromAddress,
      to: req.to,
      cc: req.cc,
      subject: req.subject,
      bodyText: req.body,
      attachments: preparedAttachments,
    });

    // 5. Send via Gmail API
    const sent = await GmailClient.sendMessage(accessToken, mimeBase64Url);

    // 6. Record outbound email in database
    const now = new Date();
    const insertRes = await pool.query(
      `
      INSERT INTO emails (
        user_id, application_id, gmail_message_id, thread_id,
        sender, sender_email, recipient, cc, subject, snippet,
        body_text, direction, category, is_read, sent_at, received_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'OUTBOUND',
        'FOLLOW_UP', true, $12, $12, NOW(), NOW()
      )
      RETURNING id;
      `,
      [
        userId,
        req.applicationId || null,
        sent.id,
        sent.threadId,
        fromAddress,
        fromAddress,
        req.to.join(', '),
        req.cc || [],
        req.subject,
        req.body.slice(0, 100),
        req.body,
        now,
      ]
    );

    // 7. Record timeline event on application
    if (req.applicationId) {
      await pool.query(
        `
        INSERT INTO application_events (
          application_id, event_type, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5);
        `,
        [
          req.applicationId,
          'EMAIL_SENT',
          `Sent email to ${req.to.join(', ')}: "${req.subject}"`,
          JSON.stringify({
            emailId: insertRes.rows[0].id,
            gmailMessageId: sent.id,
            recipients: req.to,
            subject: req.subject,
            attachmentCount: preparedAttachments.length,
          }),
          now,
        ]
      );
    }

    // 8. If draftId was provided, update draft status
    if (req.draftId) {
      await pool.query(
        "UPDATE email_drafts SET status = 'SENT', sent_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [req.draftId, userId]
      );
    }

    return {
      success: true,
      messageId: sent.id,
      threadId: sent.threadId,
    };
  }

  // ----------------------------------------------------
  // 8. Recruiter Contacts Management
  // ----------------------------------------------------

  public static async listContacts(applicationId: string, userId: string): Promise<ApplicationContact[]> {
    // Validate ownership
    const appRes = await pool.query(
      'SELECT id FROM applications WHERE id = $1 AND user_id = $2',
      [applicationId, userId]
    );
    if (appRes.rows.length === 0) {
      throw new Error('Application not found');
    }

    const res = await pool.query(
      'SELECT * FROM application_contacts WHERE application_id = $1 ORDER BY created_at ASC;',
      [applicationId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      applicationId: r.application_id,
      name: r.name,
      email: r.email,
      role: r.role,
      company: r.company,
      linkedinUrl: r.linkedin_url,
      notes: r.notes,
      createdAt: r.created_at?.toISOString() || r.created_at,
      updatedAt: r.updated_at?.toISOString() || r.updated_at,
    }));
  }

  public static async createContact(
    applicationId: string,
    userId: string,
    data: {
      name: string;
      email: string;
      role?: string;
      company?: string;
      linkedinUrl?: string;
      notes?: string;
    }
  ): Promise<ApplicationContact> {
    const appRes = await pool.query(
      'SELECT id FROM applications WHERE id = $1 AND user_id = $2',
      [applicationId, userId]
    );
    if (appRes.rows.length === 0) {
      throw new Error('Application not found');
    }

    const res = await pool.query(
      `
      INSERT INTO application_contacts (
        application_id, name, email, role, company, linkedin_url, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *;
      `,
      [
        applicationId,
        data.name,
        data.email,
        data.role || null,
        data.company || null,
        data.linkedinUrl || null,
        data.notes || null,
      ]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      applicationId: r.application_id,
      name: r.name,
      email: r.email,
      role: r.role,
      company: r.company,
      linkedinUrl: r.linkedin_url,
      notes: r.notes,
      createdAt: r.created_at?.toISOString() || r.created_at,
      updatedAt: r.updated_at?.toISOString() || r.updated_at,
    };
  }

  public static async deleteContact(contactId: string, userId: string): Promise<boolean> {
    const res = await pool.query(
      `
      DELETE FROM application_contacts
      WHERE id = $1 AND application_id IN (SELECT id FROM applications WHERE user_id = $2);
      `,
      [contactId, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  // ----------------------------------------------------
  // Row Mappers
  // ----------------------------------------------------

  private static mapEmailRow(row: any): EmailMessage {
    return {
      id: row.id,
      userId: row.user_id,
      candidateId: row.candidate_id,
      applicationId: row.application_id,
      gmailMessageId: row.gmail_message_id,
      threadId: row.thread_id,
      sender: row.sender,
      senderEmail: row.sender_email,
      senderName: row.sender_name,
      recipient: row.recipient,
      cc: row.cc || [],
      subject: row.subject,
      snippet: row.snippet,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      direction: row.direction as EmailDirection,
      category: row.category as EmailCategory,
      confidence: Number(row.confidence),
      suggestedStatus: (row.suggested_status as ApplicationStatus) || null,
      statusSuggestionHandled: Boolean(row.status_suggestion_handled),
      requiresResponse: Boolean(row.requires_response),
      isRead: Boolean(row.is_read),
      receivedAt: row.received_at?.toISOString() || row.received_at,
      sentAt: row.sent_at?.toISOString() || null,
      createdAt: row.created_at?.toISOString() || row.created_at,
      updatedAt: row.updated_at?.toISOString() || row.updated_at,
    };
  }

  private static mapDraftRow(row: any): EmailDraft {
    return {
      id: row.id,
      userId: row.user_id,
      applicationId: row.application_id,
      replyToEmailId: row.reply_to_email_id,
      purpose: row.purpose,
      tone: row.tone,
      recipient: row.recipient,
      cc: row.cc || [],
      subject: row.subject,
      body: row.body,
      attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments || [],
      status: row.status,
      sentAt: row.sent_at?.toISOString() || null,
      createdAt: row.created_at?.toISOString() || row.created_at,
      updatedAt: row.updated_at?.toISOString() || row.updated_at,
    };
  }
}
