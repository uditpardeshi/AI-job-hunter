import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { MatchingService } from '../services/matching/matchingService';
import { CandidateProfile } from '@ai-job-hunter/shared';

async function getCandidateProfile(userId: string, candidateId?: string): Promise<CandidateProfile> {
  let query = `SELECT * FROM candidate_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`;
  let params: any[] = [userId];

  if (candidateId) {
    query = `SELECT * FROM candidate_profiles WHERE id = $1 AND user_id = $2`;
    params = [candidateId, userId];
  }

  const res = await pool.query(query, params);
  if (res.rows.length === 0) {
    throw new Error('Candidate profile not found. Please upload or create a resume profile first.');
  }

  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    basics: {
      ...row.basics,
      summary: row.summary || row.basics?.summary || null,
    },
    skills: row.skills,
    experience: row.experience,
    education: row.education,
    projects: row.projects,
    certifications: row.certifications,
    achievements: row.achievements,
    preferences: row.preferences,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MatchController {
  /**
   * POST /api/jobs/:id/analyze
   */
  public static async analyzeJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.id;
      const analysis = await MatchingService.analyzeJob(jobId);
      res.status(200).json({
        success: true,
        data: analysis,
        message: 'Job analyzed successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/jobs/:id/analysis
   */
  public static async getJobAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.id;
      const analysis = await MatchingService.getJobAnalysis(jobId);
      if (!analysis) {
        res.status(404).json({
          success: false,
          error: 'Job analysis not found. Trigger analysis first.',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/jobs/:id/match
   */
  public static async matchJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const jobId = req.params.id;
      const candidateId = req.body?.candidateId || (req.query?.candidateId as string);
      const profile = await getCandidateProfile(userId, candidateId);

      const matchResult = await MatchingService.matchCandidateWithJob(profile, jobId);
      res.status(200).json({
        success: true,
        data: matchResult,
        message: 'Job matched successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/jobs/:id/match
   */
  public static async getJobMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const jobId = req.params.id;
      const candidateId = req.query?.candidateId as string;
      const profile = await getCandidateProfile(userId, candidateId);

      const matchResult = await MatchingService.getMatchResult(jobId, profile.id!);
      if (!matchResult) {
        res.status(404).json({
          success: false,
          error: 'Match result not found for this job. Call POST /api/jobs/:id/match to calculate.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: matchResult,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/matches/recalculate
   */
  public static async recalculateMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const candidateId = req.body?.candidateId || (req.query?.candidateId as string);
      const profile = await getCandidateProfile(userId, candidateId);

      const result = await MatchingService.recalculateAllMatches(profile.id!);
      res.status(200).json({
        success: true,
        data: result,
        message: `Successfully recalculated matches for ${result.totalMatched} jobs`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/matches
   */
  public static async listMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const candidateId = req.query?.candidateId as string;
      const profile = await getCandidateProfile(userId, candidateId);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

      const matches = await MatchingService.listMatchesForCandidate(profile.id!, limit);
      res.status(200).json({
        success: true,
        data: matches,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/matches/:id
   */
  public static async getMatchById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const matchId = req.params.id;
      const matchRes = await pool.query(
        `SELECT m.*, j.title AS job_title, j.company AS job_company
         FROM job_matches m
         JOIN jobs j ON j.id = m.job_id
         JOIN candidate_profiles cp ON cp.id = m.candidate_id
         WHERE m.id = $1 AND cp.user_id = $2`,
        [matchId, userId]
      );
      if (matchRes.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Match result not found.',
        });
        return;
      }

      const row = matchRes.rows[0];
      res.status(200).json({
        success: true,
        data: {
          id: row.id,
          jobId: row.job_id,
          candidateId: row.candidate_id,
          jobTitle: row.job_title,
          company: row.job_company,
          matchScore: row.match_score,
          components: row.components,
          matchedSkills: row.matched_skills || [],
          missingRequiredSkills: row.missing_required_skills || [],
          missingPreferredSkills: row.missing_preferred_skills || [],
          strengths: row.strengths || [],
          concerns: row.concerns || [],
          explanation: row.explanation,
          modelVersion: row.model_version,
          scoringVersion: row.scoring_version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
