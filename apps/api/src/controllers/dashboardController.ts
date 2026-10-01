import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService';

export class DashboardController {
  public static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
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
