import { Request, Response, NextFunction } from 'express';
import { ResumeService } from '../services/resumeService';
import { logger } from '../utils/logger';

export class ResumeController {
  public static async uploadResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ status: 'error', message: 'No resume file uploaded.' });
        return;
      }

      const userId = req.user!.id;
      const metadata = await ResumeService.registerUpload(userId, req.file);

      // Auto-trigger processing if requested or by default
      const autoProcess = req.query.autoProcess !== 'false';
      if (autoProcess) {
        try {
          const profile = await ResumeService.processResume(metadata.id, userId);
          res.status(201).json({
            status: 'ok',
            message: 'Resume uploaded and processed successfully.',
            resume: metadata,
            profile,
          });
          return;
        } catch (procErr: any) {
          logger.warn(`Resume uploaded but auto-processing failed: ${procErr.message}`);
          res.status(202).json({
            status: 'partial_success',
            message: 'Resume uploaded, but initial AI parsing encountered an issue.',
            resume: metadata,
            error: procErr.message,
          });
          return;
        }
      }

      res.status(201).json({
        status: 'ok',
        message: 'Resume uploaded successfully.',
        resume: metadata,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listResumes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const resumes = await ResumeService.listResumes(userId);
      res.status(200).json({ status: 'ok', resumes });
    } catch (err) {
      next(err);
    }
  }

  public static async getResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const resume = await ResumeService.getResume(req.params.id, userId);
      if (!resume) {
        res.status(404).json({ status: 'error', message: 'Resume not found.' });
        return;
      }
      res.status(200).json({ status: 'ok', resume });
    } catch (err) {
      next(err);
    }
  }

  public static async processResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await ResumeService.processResume(req.params.id, userId);
      res.status(200).json({
        status: 'ok',
        message: 'Resume processed successfully.',
        profile,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const deleted = await ResumeService.deleteResume(req.params.id, userId);
      if (!deleted) {
        res.status(404).json({ status: 'error', message: 'Resume not found.' });
        return;
      }
      res.status(200).json({ status: 'ok', message: 'Resume deleted.' });
    } catch (err) {
      next(err);
    }
  }

  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await ResumeService.getProfile(userId);
      if (!profile) {
        res.status(200).json({
          status: 'empty',
          profile: null,
          message: 'No candidate profile created yet. Please upload a resume.',
        });
        return;
      }
      res.status(200).json({ status: 'ok', profile });
    } catch (err) {
      next(err);
    }
  }

  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const verifiedProfile = await ResumeService.saveVerifiedProfile(userId, req.body);
      res.status(200).json({
        status: 'ok',
        message: 'Profile verified and saved successfully.',
        profile: verifiedProfile,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await ResumeService.getProfile(userId);
      res.status(200).json({
        status: 'ok',
        preferences: profile?.preferences || {},
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const updated = await ResumeService.updatePreferences(userId, req.body);
      res.status(200).json({
        status: 'ok',
        message: 'Preferences updated successfully.',
        preferences: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const versions = await ResumeService.getVersions(userId);
      res.status(200).json({ status: 'ok', versions });
    } catch (err) {
      next(err);
    }
  }
}
