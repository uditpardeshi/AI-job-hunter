import { Request, Response, NextFunction } from 'express';
import { TailoringService } from '../services/tailoring/tailoringService';

export class TailoringController {
  public static async tailorResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.user!.id;
      const { baseResumeId, instructions } = req.body || {};

      const result = await TailoringService.tailorResume(jobId, userId, baseResumeId, instructions);
      res.status(200).json({
        success: true,
        data: {
          ...result,
          summary: result.resumeData?.summary || null,
          skills: result.resumeData?.skills || [],
        },
        message: 'Resume tailored successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listTailoredResumes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.user!.id;

      const list = await TailoringService.listTailoredResumesForJob(jobId, userId);
      res.status(200).json({
        success: true,
        data: list.map((item) => ({
          ...item,
          summary: item.resumeData?.summary || null,
          skills: item.resumeData?.skills || [],
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getTailoredResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;

      const resume = await TailoringService.getTailoredResume(id, userId);
      if (!resume) {
        res.status(404).json({ success: false, error: 'Tailored resume not found.' });
        return;
      }
      res.status(200).json({
        success: true,
        data: {
          ...resume,
          summary: resume.resumeData?.summary || null,
          skills: resume.resumeData?.skills || [],
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateTailoredResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;
      const { resumeData, instructions } = req.body || {};

      if (!resumeData) {
        res.status(400).json({ success: false, error: 'resumeData is required.' });
        return;
      }

      const updated = await TailoringService.updateTailoredResume(id, userId, resumeData, instructions);
      res.status(200).json({
        success: true,
        data: {
          ...updated,
          summary: updated.resumeData?.summary || null,
          skills: updated.resumeData?.skills || [],
        },
        message: 'Tailored resume updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async validateTailoredResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;

      const resume = await TailoringService.getTailoredResume(id, userId);
      if (!resume) {
        res.status(404).json({ success: false, error: 'Tailored resume not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          status: resume.status,
          validationFlags: resume.validationFlags,
          atsAnalysis: resume.atsAnalysis,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getAtsAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;

      const resume = await TailoringService.getTailoredResume(id, userId);
      if (!resume) {
        res.status(404).json({ success: false, error: 'Tailored resume not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        data: resume.atsAnalysis,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async exportResumePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;

      const pdfBuffer = await TailoringService.exportResumePdf(id, userId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="tailored_resume_${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  public static async exportResumeDocx(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;

      const docxBuffer = await TailoringService.exportResumeDocx(id, userId);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename="tailored_resume_${id}.docx"`);
      res.send(docxBuffer);
    } catch (err) {
      next(err);
    }
  }

  // -----------------------------------------------------------------
  // Cover Letter Endpoints
  // -----------------------------------------------------------------
  public static async generateCoverLetter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.user!.id;
      const { baseResumeId, tone, instructions } = req.body || {};

      const result = await TailoringService.generateCoverLetter(jobId, userId, baseResumeId, tone, instructions);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Cover letter generated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listCoverLetters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.user!.id;

      const list = await TailoringService.listCoverLettersForJob(jobId, userId);
      res.status(200).json({
        success: true,
        data: list,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getCoverLetter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;

      const cl = await TailoringService.getCoverLetter(id, userId);
      if (!cl) {
        res.status(404).json({ success: false, error: 'Cover letter not found.' });
        return;
      }
      res.status(200).json({ success: true, data: cl });
    } catch (err) {
      next(err);
    }
  }

  public static async updateCoverLetter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;
      const { content, tone, instructions } = req.body || {};

      if (!content) {
        res.status(400).json({ success: false, error: 'content is required.' });
        return;
      }

      const updated = await TailoringService.updateCoverLetter(id, userId, content, tone, instructions);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Cover letter updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async exportCoverLetterPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;

      const pdfBuffer = await TailoringService.exportCoverLetterPdf(id, userId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cover_letter_${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  public static async exportCoverLetterDocx(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const userId = req.user!.id;

      const docxBuffer = await TailoringService.exportCoverLetterDocx(id, userId);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename="cover_letter_${id}.docx"`);
      res.send(docxBuffer);
    } catch (err) {
      next(err);
    }
  }
}
