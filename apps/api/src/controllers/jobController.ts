import { Request, Response, NextFunction } from 'express';
import { JobService } from '../services/jobService';
import { jobCollector } from '../services/jobCollector';
import { sourceRegistry } from '../connectors/registry';
import { JobSearchParams } from '@ai-job-hunter/shared';

export class JobController {
  /**
   * GET /api/jobs
   */
  public static async getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const searchParams: JobSearchParams = {
        q: req.query.q as string,
        location: req.query.location as string,
        remoteType: req.query.remoteType as any,
        employmentType: req.query.employmentType as any,
        company: req.query.company as string,
        source: req.query.source as string,
        postedAfter: req.query.postedAfter as string,
        postedBefore: req.query.postedBefore as string,
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      };

      const result = await JobService.searchJobs(searchParams);
      res.status(200).json({
        status: 'ok',
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/jobs/:id
   */
  public static async getJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await JobService.getJobById(req.params.id);
      if (!job) {
        res.status(404).json({ status: 'error', message: 'Job not found.' });
        return;
      }
      res.status(200).json({
        status: 'ok',
        job,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/jobs/sync
   */
  public static async triggerSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sourceId = (req.query.sourceId || req.body.sourceId) as string | undefined;
      const results = await jobCollector.sync(sourceId);

      const hasFailures = results.some((r) => r.status === 'failed');

      res.status(hasFailures ? 207 : 200).json({
        status: hasFailures ? 'partial_success' : 'ok',
        message: 'Job collection sync completed.',
        results,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/job-sources
   */
  public static async getSources(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sources = await sourceRegistry.getSourceConfigs();
      res.status(200).json({
        status: 'ok',
        sources,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/job-sources/:id
   */
  public static async getSourceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sources = await sourceRegistry.getSourceConfigs();
      const source = sources.find((s) => s.id === req.params.id);
      if (!source) {
        res.status(404).json({ status: 'error', message: 'Source not found.' });
        return;
      }
      res.status(200).json({
        status: 'ok',
        source,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/job-sources/:id/syncs
   */
  public static async getSourceSyncs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const syncs = await JobService.getSourceSyncs(req.params.id, limit);
      res.status(200).json({
        status: 'ok',
        syncs,
      });
    } catch (err) {
      next(err);
    }
  }
}
