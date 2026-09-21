import { pool } from '../../db';
import {
  CandidateProfile,
  TailoredResume,
  CoverLetter,
  TailoredResumeData,
  ValidationFlag,
  AtsAnalysisResult,
  TailoringChanges,
} from '@ai-job-hunter/shared';
import { logger } from '../../utils/logger';
import {
  tailorResumeWithAi,
  generateCoverLetterWithAi,
  exportDocumentWithAi,
} from '../aiClient';
import { MatchingService } from '../matching/matchingService';
import { AntiFabricationValidator } from './antiFabricationValidator';
import { AtsAnalyzer } from './atsAnalyzer';

export const PROMPT_VERSION = 'v1.0-strict-anti-fabrication';

export class TailoringService {
  /**
   * Helper to retrieve verified candidate profile.
   */
  private static async getCandidateProfile(userId: string): Promise<CandidateProfile> {
    const res = await pool.query(
      `SELECT * FROM candidate_profiles WHERE user_id = $1`,
      [userId]
    );

    if (res.rows.length === 0) {
      throw new Error('Candidate profile not found. Please upload and verify your resume first.');
    }

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      basics: {
        ...row.basics,
        summary: row.summary || row.basics?.summary || null,
      },
      skills: row.skills || [],
      experience: row.experience || [],
      education: row.education || [],
      projects: row.projects || [],
      certifications: row.certifications || [],
      achievements: row.achievements || [],
      preferences: row.preferences || {},
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Generate a tailored resume draft for a specific job.
   */
  public static async tailorResume(
    jobId: string,
    userId: string,
    baseResumeId?: string | null,
    instructions?: string
  ): Promise<TailoredResume> {
    const profile = await this.getCandidateProfile(userId);

    // Fetch Job Details
    const jobRes = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobRes.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }
    const job = jobRes.rows[0];

    // Ensure Job Analysis exists
    let analysis = await MatchingService.getJobAnalysis(jobId);
    if (!analysis) {
      try {
        analysis = await MatchingService.analyzeJob(jobId);
      } catch (err) {
        logger.warn(`Could not run automatic job analysis for ${jobId}:`, err);
      }
    }

    const requiredSkills = analysis?.requiredSkills || job.skills || [];
    const preferredSkills = analysis?.preferredSkills || [];

    // Record Generation Run (Audit Trail)
    const runRes = await pool.query(
      `
      INSERT INTO resume_generation_runs (
        user_id, job_id, base_resume_id, type, status, model_version, prompt_version
      ) VALUES ($1, $2, $3, 'tailor_resume', 'processing', 'ai-service', $4)
      RETURNING id;
      `,
      [userId, jobId, baseResumeId || null, PROMPT_VERSION]
    );
    const runId = runRes.rows[0].id;

    try {
      // Call AI Service for tailoring
      const aiResponse = await tailorResumeWithAi({
        candidateProfile: profile,
        jobTitle: job.title,
        jobCompany: job.company,
        jobDescription: job.description,
        requiredSkills,
        preferredSkills,
        userInstructions: instructions,
      });

      const resumeData: TailoredResumeData = {
        header: aiResponse.data.header || {
          name: profile.basics.name || '',
          email: profile.basics.email || '',
          phone: profile.basics.phone || '',
          location: profile.basics.location || '',
          linkedin: profile.basics.linkedin || '',
          github: profile.basics.github || '',
          portfolio: profile.basics.portfolio || '',
        },
        summary: aiResponse.data.summary || profile.basics.summary || '',
        skills: aiResponse.data.skills || profile.skills || [],
        experience: aiResponse.data.experience || [],
        projects: aiResponse.data.projects || [],
        education: aiResponse.data.education || profile.education || [],
        certifications: aiResponse.data.certifications || profile.certifications || [],
        achievements: aiResponse.data.achievements || profile.achievements || [],
      };

      const tailoringChanges: TailoringChanges = aiResponse.data.tailoringChanges || {
        emphasized: [],
        reordered: [],
        deemphasized: [],
        notAdded: [],
      };

      // Run Anti-Fabrication Validation
      const validationFlags = AntiFabricationValidator.validate(resumeData, profile);

      // Run ATS Alignment Analysis
      const atsAnalysis = AtsAnalyzer.analyze(
        resumeData,
        requiredSkills,
        preferredSkills,
        job.description
      );

      // Determine Version Number
      const verRes = await pool.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver FROM tailored_resumes WHERE job_id = $1 AND user_id = $2`,
        [jobId, userId]
      );
      const versionNumber = Number(verRes.rows[0].next_ver);

      const status = validationFlags.length > 0 ? 'needs_review' : 'completed';
      const title = `${job.title} - ${job.company} (v${versionNumber})`;

      // Insert tailored resume record
      const insertRes = await pool.query(
        `
        INSERT INTO tailored_resumes (
          user_id, job_id, base_resume_id, version_number, title,
          resume_data, tailoring_changes, ats_analysis, validation_flags,
          status, instructions, model_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
        `,
        [
          userId,
          jobId,
          baseResumeId || null,
          versionNumber,
          title,
          JSON.stringify(resumeData),
          JSON.stringify(tailoringChanges),
          JSON.stringify(atsAnalysis),
          JSON.stringify(validationFlags),
          status,
          instructions || null,
          aiResponse.modelUsed,
        ]
      );

      // Complete generation run
      await pool.query(
        `UPDATE resume_generation_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [runId]
      );

      const row = insertRes.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        jobId: row.job_id,
        baseResumeId: row.base_resume_id,
        versionNumber: row.version_number,
        title: row.title,
        resumeData: row.resume_data,
        tailoringChanges: row.tailoring_changes,
        atsAnalysis: row.ats_analysis,
        validationFlags: row.validation_flags,
        status: row.status,
        instructions: row.instructions,
        modelVersion: row.model_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      await pool.query(
        `UPDATE resume_generation_runs SET status = 'failed', completed_at = NOW(), error_message = $2 WHERE id = $1`,
        [runId, err.message]
      );
      throw err;
    }
  }

  /**
   * Update an existing tailored resume (user editing or resolving validation flags).
   */
  public static async updateTailoredResume(
    id: string,
    userId: string,
    resumeData: TailoredResumeData,
    instructions?: string
  ): Promise<TailoredResume> {
    const profile = await this.getCandidateProfile(userId);

    // Fetch existing tailored resume
    const existingRes = await pool.query(
      `SELECT * FROM tailored_resumes WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (existingRes.rows.length === 0) {
      throw new Error(`Tailored resume not found: ${id}`);
    }
    const existing = existingRes.rows[0];

    // Fetch Job & Analysis for re-evaluating ATS score
    const jobRes = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [existing.job_id]);
    const job = jobRes.rows[0];
    const analysis = await MatchingService.getJobAnalysis(existing.job_id);

    const requiredSkills = analysis?.requiredSkills || job?.skills || [];
    const preferredSkills = analysis?.preferredSkills || [];

    // Re-run validation
    const validationFlags = AntiFabricationValidator.validate(resumeData, profile);

    // Re-run ATS alignment
    const atsAnalysis = AtsAnalyzer.analyze(
      resumeData,
      requiredSkills,
      preferredSkills,
      job?.description || ''
    );

    const status = validationFlags.length > 0 ? 'needs_review' : 'completed';

    const updateRes = await pool.query(
      `
      UPDATE tailored_resumes
      SET resume_data = $1,
          ats_analysis = $2,
          validation_flags = $3,
          status = $4,
          instructions = COALESCE($5, instructions),
          updated_at = NOW()
      WHERE id = $6 AND user_id = $7
      RETURNING *;
      `,
      [
        JSON.stringify(resumeData),
        JSON.stringify(atsAnalysis),
        JSON.stringify(validationFlags),
        status,
        instructions || null,
        id,
        userId,
      ]
    );

    const row = updateRes.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      baseResumeId: row.base_resume_id,
      versionNumber: row.version_number,
      title: row.title,
      resumeData: row.resume_data,
      tailoringChanges: row.tailoring_changes,
      atsAnalysis: row.ats_analysis,
      validationFlags: row.validation_flags,
      status: row.status,
      instructions: row.instructions,
      modelVersion: row.model_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static async getTailoredResume(id: string, userId: string): Promise<TailoredResume | null> {
    const res = await pool.query(
      `SELECT * FROM tailored_resumes WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      baseResumeId: row.base_resume_id,
      versionNumber: row.version_number,
      title: row.title,
      resumeData: row.resume_data,
      tailoringChanges: row.tailoring_changes,
      atsAnalysis: row.ats_analysis,
      validationFlags: row.validation_flags,
      status: row.status,
      instructions: row.instructions,
      modelVersion: row.model_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static async listTailoredResumesForJob(jobId: string, userId: string): Promise<TailoredResume[]> {
    const res = await pool.query(
      `SELECT * FROM tailored_resumes WHERE job_id = $1 AND user_id = $2 ORDER BY version_number DESC`,
      [jobId, userId]
    );

    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      baseResumeId: row.base_resume_id,
      versionNumber: row.version_number,
      title: row.title,
      resumeData: row.resume_data,
      tailoringChanges: row.tailoring_changes,
      atsAnalysis: row.ats_analysis,
      validationFlags: row.validation_flags,
      status: row.status,
      instructions: row.instructions,
      modelVersion: row.model_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Generate a targeted cover letter for a specific job.
   */
  public static async generateCoverLetter(
    jobId: string,
    userId: string,
    baseResumeId?: string | null,
    tone: 'professional' | 'conversational' | 'enthusiastic' = 'professional',
    instructions?: string
  ): Promise<CoverLetter> {
    const profile = await this.getCandidateProfile(userId);

    const jobRes = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobRes.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }
    const job = jobRes.rows[0];

    // Audit Run
    const runRes = await pool.query(
      `
      INSERT INTO resume_generation_runs (
        user_id, job_id, base_resume_id, type, status, model_version, prompt_version
      ) VALUES ($1, $2, $3, 'cover_letter', 'processing', 'ai-service', $4)
      RETURNING id;
      `,
      [userId, jobId, baseResumeId || null, PROMPT_VERSION]
    );
    const runId = runRes.rows[0].id;

    try {
      const aiResponse = await generateCoverLetterWithAi({
        candidateProfile: profile,
        jobTitle: job.title,
        jobCompany: job.company,
        jobDescription: job.description,
        tone,
        userInstructions: instructions,
      });

      const verRes = await pool.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver FROM cover_letters WHERE job_id = $1 AND user_id = $2`,
        [jobId, userId]
      );
      const versionNumber = Number(verRes.rows[0].next_ver);

      const title = `Cover Letter - ${job.title} at ${job.company} (v${versionNumber})`;
      const content = aiResponse.data.content || '';

      const insertRes = await pool.query(
        `
        INSERT INTO cover_letters (
          user_id, job_id, base_resume_id, version_number, title, content, tone, instructions, model_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
        `,
        [
          userId,
          jobId,
          baseResumeId || null,
          versionNumber,
          title,
          content,
          tone,
          instructions || null,
          aiResponse.modelUsed,
        ]
      );

      await pool.query(
        `UPDATE resume_generation_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [runId]
      );

      const row = insertRes.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        jobId: row.job_id,
        baseResumeId: row.base_resume_id,
        versionNumber: row.version_number,
        title: row.title,
        content: row.content,
        tone: row.tone,
        instructions: row.instructions,
        modelVersion: row.model_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      await pool.query(
        `UPDATE resume_generation_runs SET status = 'failed', completed_at = NOW(), error_message = $2 WHERE id = $1`,
        [runId, err.message]
      );
      throw err;
    }
  }

  public static async updateCoverLetter(
    id: string,
    userId: string,
    content: string,
    tone?: 'professional' | 'conversational' | 'enthusiastic',
    instructions?: string
  ): Promise<CoverLetter> {
    const updateRes = await pool.query(
      `
      UPDATE cover_letters
      SET content = $1,
          tone = COALESCE($2, tone),
          instructions = COALESCE($3, instructions),
          updated_at = NOW()
      WHERE id = $4 AND user_id = $5
      RETURNING *;
      `,
      [content, tone || null, instructions || null, id, userId]
    );

    if (updateRes.rows.length === 0) {
      throw new Error(`Cover letter not found: ${id}`);
    }

    const row = updateRes.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      baseResumeId: row.base_resume_id,
      versionNumber: row.version_number,
      title: row.title,
      content: row.content,
      tone: row.tone,
      instructions: row.instructions,
      modelVersion: row.model_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static async getCoverLetter(id: string, userId: string): Promise<CoverLetter | null> {
    const res = await pool.query(
      `SELECT * FROM cover_letters WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      baseResumeId: row.base_resume_id,
      versionNumber: row.version_number,
      title: row.title,
      content: row.content,
      tone: row.tone,
      instructions: row.instructions,
      modelVersion: row.model_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static async listCoverLettersForJob(jobId: string, userId: string): Promise<CoverLetter[]> {
    const res = await pool.query(
      `SELECT * FROM cover_letters WHERE job_id = $1 AND user_id = $2 ORDER BY version_number DESC`,
      [jobId, userId]
    );

    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      baseResumeId: row.base_resume_id,
      versionNumber: row.version_number,
      title: row.title,
      content: row.content,
      tone: row.tone,
      instructions: row.instructions,
      modelVersion: row.model_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // -----------------------------------------------------------------
  // Document Exports
  // -----------------------------------------------------------------
  public static async exportResumePdf(id: string, userId: string): Promise<Buffer> {
    const resume = await this.getTailoredResume(id, userId);
    if (!resume) throw new Error(`Tailored resume not found: ${id}`);
    return exportDocumentWithAi('export/pdf', { resumeData: resume.resumeData });
  }

  public static async exportResumeDocx(id: string, userId: string): Promise<Buffer> {
    const resume = await this.getTailoredResume(id, userId);
    if (!resume) throw new Error(`Tailored resume not found: ${id}`);
    return exportDocumentWithAi('export/docx', { resumeData: resume.resumeData });
  }

  public static async exportCoverLetterPdf(id: string, userId: string): Promise<Buffer> {
    const cl = await this.getCoverLetter(id, userId);
    if (!cl) throw new Error(`Cover letter not found: ${id}`);
    const profile = await this.getCandidateProfile(userId);
    return exportDocumentWithAi('export/cover-letter/pdf', {
      title: cl.title,
      content: cl.content,
      candidateName: profile.basics.name || '',
    });
  }

  public static async exportCoverLetterDocx(id: string, userId: string): Promise<Buffer> {
    const cl = await this.getCoverLetter(id, userId);
    if (!cl) throw new Error(`Cover letter not found: ${id}`);
    const profile = await this.getCandidateProfile(userId);
    return exportDocumentWithAi('export/cover-letter/docx', {
      title: cl.title,
      content: cl.content,
      candidateName: profile.basics.name || '',
    });
  }
}
