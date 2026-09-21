import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export class DashboardController {
  public static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.headers['x-user-id'] as string) || DEFAULT_USER_ID;
      const data = await DashboardService.getDashboardData(userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
}
