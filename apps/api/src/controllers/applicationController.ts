import { Request, Response, NextFunction } from 'express';
import { ApplicationService } from '../services/applicationService';
import { ApplicationStatus } from '@ai-job-hunter/shared';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export class ApplicationController {
  public static async createApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const {
        jobId,
        status,
        resumeId,
        tailoredResumeId,
        coverLetterId,
        externalApplicationUrl,
        nextFollowUpAt,
        notes,
      } = req.body || {};

      if (!jobId) {
        res.status(400).json({ success: false, error: 'jobId is required' });
        return;
      }

      const application = await ApplicationService.createApplication(userId, {
        jobId,
        status: status as ApplicationStatus,
        resumeId,
        tailoredResumeId,
        coverLetterId,
        externalApplicationUrl,
        nextFollowUpAt,
        notes,
      });

      res.status(201).json({
        success: true,
        data: application,
        message: 'Application created successfully',
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        res.status(409).json({
          success: false,
          error: err.message,
          existingApplicationId: err.existingApplicationId,
        });
        return;
      }
      next(err);
    }
  }

  public static async listApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const {
        jobId,
        status,
        company,
        jobTitle,
        location,
        remoteType,
        source,
        hasFollowUp,
        search,
        sortBy,
        sortOrder,
        page,
        limit,
      } = req.query;

      const result = await ApplicationService.listApplications(userId, {
        jobId: jobId as string,
        status: status as any,
        company: company as string,
        jobTitle: jobTitle as string,
        location: location as string,
        remoteType: remoteType as string,
        source: source as string,
        hasFollowUp: hasFollowUp === 'true',
        search: search as string,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.applications,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const id = req.params.id;

      const application = await ApplicationService.getApplicationById(id, userId);
      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: application,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const id = req.params.id;
      const { tailoredResumeId, coverLetterId, resumeId, externalApplicationUrl, notes } = req.body || {};

      const updated = await ApplicationService.updateApplication(id, userId, {
        tailoredResumeId,
        coverLetterId,
        resumeId,
        externalApplicationUrl,
        notes,
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Application updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const id = req.params.id;
      const { status, reason } = req.body || {};

      if (!status) {
        res.status(400).json({ success: false, error: 'status is required' });
        return;
      }

      const updated = await ApplicationService.updateStatus(id, userId, status as ApplicationStatus, reason);

      res.status(200).json({
        success: true,
        data: updated,
        message: `Status updated to ${status}`,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateFollowUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const id = req.params.id;
      const { nextFollowUpAt, isCompleted } = req.body || {};

      const updated = await ApplicationService.updateFollowUp(
        id,
        userId,
        nextFollowUpAt || null,
        Boolean(isCompleted)
      );

      res.status(200).json({
        success: true,
        data: updated,
        message: isCompleted ? 'Follow-up marked as completed' : 'Follow-up updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const id = req.params.id;
      const { noteText, note } = req.body || {};
      const content = noteText || note;

      if (!content || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ success: false, error: 'noteText or note is required' });
        return;
      }

      const updated = await ApplicationService.addNote(id, userId, content.trim());

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Note added to application',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const id = req.params.id;

      const events = await ApplicationService.getTimeline(id, userId);

      res.status(200).json({
        success: true,
        data: events,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const id = req.params.id;

      const deleted = await ApplicationService.deleteApplication(id, userId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Application deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
