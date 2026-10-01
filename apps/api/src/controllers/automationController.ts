import { Request, Response, NextFunction } from 'express';
import { AutomationService } from '../services/automationService';
import { QueueManager } from '../queues/queueManager';

export class AutomationController {
  public static async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const settings = await AutomationService.getSettings(userId);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  public static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const settings = await AutomationService.updateSettings(userId, req.body);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  public static async triggerKillSwitch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { reason } = req.body;
      const settings = await AutomationService.triggerKillSwitch(userId, reason);
      res.json({ success: true, data: settings, message: 'Emergency Kill Switch activated' });
    } catch (err) {
      next(err);
    }
  }

  public static async resumeKillSwitch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const settings = await AutomationService.resumeKillSwitch(userId);
      res.json({ success: true, data: settings, message: 'Automation resumed' });
    } catch (err) {
      next(err);
    }
  }

  public static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const summary = await AutomationService.getAutomationSummary(userId);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  public static async triggerRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { source } = req.body;
      const result = await QueueManager.triggerRun(userId, source);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async listRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const result = await AutomationService.listAutomationRuns(userId, page, limit);
      res.json({ success: true, data: result.runs, total: result.total, page, limit });
    } catch (err) {
      next(err);
    }
  }

  public static async getRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const run = await AutomationService.getAutomationRun(req.params.id, userId);
      if (!run) {
        res.status(404).json({ success: false, error: 'Automation run not found' });
        return;
      }
      res.json({ success: true, data: run });
    } catch (err) {
      next(err);
    }
  }

  public static async listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const runId = req.query.runId as string | undefined;
      const limit = parseInt(req.query.limit as string || '50', 10);
      const events = await AutomationService.listAutomationEvents(userId, runId, limit);
      res.json({ success: true, data: events });
    } catch (err) {
      next(err);
    }
  }

  // Job Search Profiles
  public static async listProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profiles = await AutomationService.listSearchProfiles(userId);
      res.json({ success: true, data: profiles });
    } catch (err) {
      next(err);
    }
  }

  public static async createProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await AutomationService.createSearchProfile(userId, req.body);
      res.status(201).json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await AutomationService.getSearchProfile(req.params.id, userId);
      if (!profile) {
        res.status(404).json({ success: false, error: 'Search profile not found' });
        return;
      }
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await AutomationService.updateSearchProfile(req.params.id, userId, req.body);
      if (!profile) {
        res.status(404).json({ success: false, error: 'Search profile not found' });
        return;
      }
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const deleted = await AutomationService.deleteSearchProfile(req.params.id, userId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Search profile not found' });
        return;
      }
      res.json({ success: true, message: 'Search profile deleted' });
    } catch (err) {
      next(err);
    }
  }
}
