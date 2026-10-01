import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/emailService';
import { EmailCategory, EmailDirection } from '@ai-job-hunter/shared';

export class EmailController {
  public static async listEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        category,
        applicationId,
        direction,
        isRead,
        requiresResponse,
        search,
        page,
        limit,
      } = req.query;

      const result = await EmailService.listEmails(userId, {
        category: category as EmailCategory,
        applicationId: applicationId as string,
        direction: direction as EmailDirection,
        isRead: isRead !== undefined ? isRead === 'true' : undefined,
        requiresResponse: requiresResponse !== undefined ? requiresResponse === 'true' : undefined,
        search: search as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.emails,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const id = req.params.id;

      const email = await EmailService.getEmailById(id, userId);
      if (!email) {
        res.status(404).json({ success: false, error: 'Email not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: email,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async associateEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const id = req.params.id;
      const { applicationId } = req.body || {};

      if (!applicationId) {
        res.status(400).json({ success: false, error: 'applicationId is required' });
        return;
      }

      const updated = await EmailService.associateEmailWithApplication(id, userId, applicationId);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Email associated with application',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async handleSuggestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const id = req.params.id;
      const { action } = req.body || {};

      if (!action || !['accept', 'ignore'].includes(action)) {
        res.status(400).json({ success: false, error: 'action must be "accept" or "ignore"' });
        return;
      }

      const result = await EmailService.handleStatusSuggestion(id, userId, action);

      res.status(200).json({
        success: true,
        data: result,
        message: action === 'accept' ? 'Status update accepted' : 'Status suggestion dismissed',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async generateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { applicationId, emailId, purpose, tone, userInstructions } = req.body || {};

      if (!purpose) {
        res.status(400).json({ success: false, error: 'purpose is required' });
        return;
      }

      const draft = await EmailService.generateDraft(userId, {
        applicationId,
        emailId,
        purpose,
        tone,
        userInstructions,
      });

      res.status(200).json({
        success: true,
        data: draft,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async generateReplyForEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const emailId = req.params.id;
      const { purpose = 'RECRUITER_REPLY', tone = 'professional', userInstructions, applicationId } = req.body || {};

      const draft = await EmailService.generateDraft(userId, {
        applicationId,
        emailId,
        purpose,
        tone,
        userInstructions,
      });

      res.status(200).json({
        success: true,
        data: draft,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async saveDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const draftData = req.body || {};

      const saved = await EmailService.saveDraft(userId, draftData);

      res.status(200).json({
        success: true,
        data: saved,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const draftId = req.params.id;
      const updates = req.body || {};

      const updated = await EmailService.updateDraft(draftId, userId, updates);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const draftId = req.params.id;

      const deleted = await EmailService.deleteDraft(draftId, userId);
      res.status(200).json({
        success: true,
        message: deleted ? 'Draft discarded' : 'Draft not found',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listDrafts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { applicationId } = req.query;

      const drafts = await EmailService.listDrafts(userId, applicationId as string);

      res.status(200).json({
        success: true,
        data: drafts,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listDraftsForEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const emailId = req.params.id;

      const drafts = await EmailService.listDrafts(userId, undefined, emailId);

      res.status(200).json({
        success: true,
        data: drafts,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { applicationId, draftId, to, cc, subject, body, attachments } = req.body || {};

      if (!to || !Array.isArray(to) || to.length === 0) {
        res.status(400).json({ success: false, error: 'At least one recipient email ("to") is required' });
        return;
      }

      if (!subject || !subject.trim()) {
        res.status(400).json({ success: false, error: 'Email subject is required' });
        return;
      }

      if (!body || !body.trim()) {
        res.status(400).json({ success: false, error: 'Email body is required' });
        return;
      }

      const result = await EmailService.sendEmail(userId, {
        applicationId,
        draftId,
        to,
        cc,
        subject,
        body,
        attachments,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Email successfully sent via Gmail',
      });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // Contacts
  // ----------------------------------------------------

  public static async listContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const applicationId = req.params.applicationId;

      const contacts = await EmailService.listContacts(applicationId, userId);

      res.status(200).json({
        success: true,
        data: contacts,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async createContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const applicationId = req.params.applicationId;
      const { name, email, role, company, linkedinUrl, notes } = req.body || {};

      if (!name || !email) {
        res.status(400).json({ success: false, error: 'name and email are required for a contact' });
        return;
      }

      const contact = await EmailService.createContact(applicationId, userId, {
        name,
        email,
        role,
        company,
        linkedinUrl,
        notes,
      });

      res.status(201).json({
        success: true,
        data: contact,
        message: 'Contact added',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const contactId = req.params.contactId;

      const deleted = await EmailService.deleteContact(contactId, userId);

      res.status(200).json({
        success: true,
        message: deleted ? 'Contact deleted' : 'Contact not found',
      });
    } catch (err) {
      next(err);
    }
  }
}
