import { Request, Response, NextFunction } from 'express';
import { ApplicationPreparationService } from '../services/applicationPreparationService';
import { PreparationStatus } from '@ai-job-hunter/shared';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export class ApprovalController {
  public static async listApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id || DEFAULT_USER_ID;
      const status = req.query.status as PreparationStatus | undefined;
      const items = await ApplicationPreparationService.listApprovalItems(userId, status);
      res.json({ success: true, data: items, count: items.length });
    } catch (err) {
      next(err);
    }
  }

  public static async getApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id || DEFAULT_USER_ID;
      const item = await ApplicationPreparationService.getPreparationById(req.params.id, userId);
      if (!item) {
        res.status(404).json({ success: false, error: 'Approval item not found' });
        return;
      }
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }

  public static async updateAnswers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id || DEFAULT_USER_ID;
      const answers = req.body.answers;
      if (!answers || typeof answers !== 'object') {
        res.status(400).json({ success: false, error: 'Answers map is required' });
        return;
      }
      const updated = await ApplicationPreparationService.updateQuestionAnswers(req.params.id, userId, answers);
      res.json({ success: true, data: updated, message: 'Answers updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  public static async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id || DEFAULT_USER_ID;
      const { notes } = req.body;
      const result = await ApplicationPreparationService.approveAndSubmit(req.params.id, userId, notes);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id || DEFAULT_USER_ID;
      const { reason } = req.body;
      const result = await ApplicationPreparationService.rejectPreparation(req.params.id, userId, reason);
      res.json({ success: true, data: result, message: 'Application rejected' });
    } catch (err) {
      next(err);
    }
  }
}
