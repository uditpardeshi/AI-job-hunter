import { pool } from '../db';
import {
  ApplicationPreparation,
  ApplicationQuestion,
  ApprovalItem,
  PreparationStatus,
  ApplicationSubmission,
} from '@ai-job-hunter/shared';
import { ApplicationAnswerEngine } from './applicationAnswerEngine';
import { sourceRegistry } from '../connectors/registry';
import { AutomationService } from './automationService';
import { ApplicationService } from './applicationService';
import { TailoringService } from './tailoring/tailoringService';
import { config } from '../config';
import { logger } from '../utils/logger';

export class ApplicationPreparationService {
  /**
   * Prepare an application for a given job and application record
   */
  public static async prepareApplication(params: {
    userId: string;
    jobId: string;
    applicationId: string;
    automationRunId?: string;
    forceRegenerate?: boolean;
  }): Promise<ApplicationPreparation> {
    const { userId, jobId, applicationId, automationRunId, forceRegenerate } = params;

    // Check existing preparation
    const existingRes = await pool.query(
      `SELECT * FROM application_preparations WHERE application_id = $1`,
      [applicationId]
    );

    if (existingRes.rows.length > 0 && !forceRegenerate) {
      return this.getPreparationById(existingRes.rows[0].id, userId) as Promise<ApplicationPreparation>;
    }

    // 1. Fetch Job
    const jobRes = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobRes.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }
    const jobRow = jobRes.rows[0];

    // 2. Fetch Candidate Profile & Resumes
    const profileRes = await pool.query(`SELECT * FROM candidate_profiles WHERE user_id = $1`, [userId]);
    const candidateProfile = profileRes.rows[0] || null;

    // 3. Get or generate tailored materials based on automation settings
    const settings = await AutomationService.getSettings(userId);
    let tailoredResumeId: string | null = null;
    let coverLetterId: string | null = null;

    if (candidateProfile) {
      if (settings.autoTailoringEnabled) {
        try {
          const tailored = await TailoringService.tailorResume(jobId, userId);
          tailoredResumeId = tailored.id;
          await AutomationService.logAutomationEvent({
            automationRunId,
            userId,
            candidateId: candidateProfile.id,
            jobId,
            applicationId,
            eventType: 'RESUME_GENERATED',
            status: 'SUCCESS',
            message: `Auto-tailored resume generated for ${jobRow.title}`,
          });
        } catch (e: any) {
          logger.warn(`Failed to auto-tailor resume for job ${jobId}: ${e.message}`);
        }
      }

      if (settings.autoCoverLetterEnabled) {
        try {
          const cl = await TailoringService.generateCoverLetter(jobId, userId);
          coverLetterId = cl.id;
          await AutomationService.logAutomationEvent({
            automationRunId,
            userId,
            candidateId: candidateProfile.id,
            jobId,
            applicationId,
            eventType: 'COVER_LETTER_GENERATED',
            status: 'SUCCESS',
            message: `Auto-generated cover letter for ${jobRow.title}`,
          });
        } catch (e: any) {
          logger.warn(`Failed to auto-generate cover letter for job ${jobId}: ${e.message}`);
        }
      }
    }

    // 4. Questions discovery: check connector or derive standard questions
    const sourceKey = jobRow.source_id || jobRow.source || 'unknown';
    const connector = sourceRegistry.getApplicationConnector(sourceKey);
    let rawQuestions = [
      { question: 'Full Name' },
      { question: 'Email Address' },
      { question: 'Phone Number' },
      { question: 'Current Location' },
      { question: 'LinkedIn Profile' },
      { question: 'Years of Experience' },
      { question: 'Are you legally authorized to work in the country of this job?' },
      { question: 'Will you now or in the future require visa sponsorship?' },
      { question: 'Desired Salary / Compensation expectation' },
    ];

    if (connector) {
      try {
        const prepResult = await connector.prepareApplication({
          jobId,
          applicationId,
          candidateProfile,
          settings,
        });
        if (prepResult.questions && prepResult.questions.length > 0) {
          rawQuestions = prepResult.questions.map((q: any) => ({
            question: q.question,
            questionType: q.questionType,
            options: q.options,
          }));
        }
      } catch (err: any) {
        logger.warn(`Connector prepareApplication failed for ${jobRow.source_id || jobRow.source}: ${err.message}`);
      }
    }

    // 5. Run ApplicationAnswerEngine
    const answerResult = ApplicationAnswerEngine.prepareQuestions(
      rawQuestions,
      candidateProfile
        ? {
            id: candidateProfile.id,
            basics: candidateProfile.basics,
            summary: candidateProfile.summary,
            skills: candidateProfile.skills,
            experience: candidateProfile.experience,
            education: candidateProfile.education,
            preferences: candidateProfile.preferences,
          }
        : null
    );

    // Determine readiness status
    const hasSensitiveNeedsInput = answerResult.questions.some(
      (q) => q.isSensitive || (q.requiresUserInput && !q.candidateAnswer)
    );
    const initialStatus: PreparationStatus = hasSensitiveNeedsInput ? 'NEEDS_USER_INPUT' : 'READY';

    // 6. Store Application Preparation
    const client = await pool.connect();
    let prepId: string;

    try {
      await client.query('BEGIN');

      if (existingRes.rows.length > 0) {
        // Delete old questions
        await client.query(`DELETE FROM application_questions WHERE application_preparation_id = $1`, [
          existingRes.rows[0].id,
        ]);
        const updateRes = await client.query(
          `UPDATE application_preparations SET
            status = $1,
            tailored_resume_id = COALESCE($2, tailored_resume_id),
            cover_letter_id = COALESCE($3, cover_letter_id),
            prepared_answers = $4,
            missing_answers = $5,
            warnings = $6,
            updated_at = NOW()
          WHERE id = $7
          RETURNING id`,
          [
            initialStatus,
            tailoredResumeId,
            coverLetterId,
            JSON.stringify(answerResult.preparedAnswers),
            answerResult.missingAnswers,
            answerResult.warnings,
            existingRes.rows[0].id,
          ]
        );
        prepId = updateRes.rows[0].id;
      } else {
        const insertRes = await client.query(
          `INSERT INTO application_preparations (
            user_id, application_id, job_id, source, status,
            tailored_resume_id, cover_letter_id, prepared_answers,
            missing_answers, warnings
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            userId,
            applicationId,
            jobId,
            jobRow.source_id || jobRow.source,
            initialStatus,
            tailoredResumeId,
            coverLetterId,
            JSON.stringify(answerResult.preparedAnswers),
            answerResult.missingAnswers,
            answerResult.warnings,
          ]
        );
        prepId = insertRes.rows[0].id;
      }

      // Insert Questions
      for (const q of answerResult.questions) {
        await client.query(
          `INSERT INTO application_questions (
            application_preparation_id, question, question_type,
            candidate_answer, answer_source, confidence,
            requires_user_input, is_sensitive, options
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            prepId,
            q.question,
            q.questionType,
            q.candidateAnswer || null,
            q.answerSource,
            q.confidence,
            q.requiresUserInput,
            q.isSensitive,
            JSON.stringify(q.options || []),
          ]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // 7. Log Events
    await AutomationService.logAutomationEvent({
      automationRunId,
      userId,
      candidateId: candidateProfile?.id,
      jobId,
      applicationId,
      eventType: 'APPLICATION_PREPARED',
      status: initialStatus === 'READY' ? 'SUCCESS' : 'WARNING',
      message: `Application prepared for ${jobRow.title} at ${jobRow.company} (${initialStatus})`,
      metadata: {
        status: initialStatus,
        missingCount: answerResult.missingAnswers.length,
        warningsCount: answerResult.warnings.length,
      },
    });

    if (initialStatus === 'NEEDS_USER_INPUT' || settings.applicationApprovalRequired) {
      await AutomationService.logAutomationEvent({
        automationRunId,
        userId,
        candidateId: candidateProfile?.id,
        jobId,
        applicationId,
        eventType: 'APPROVAL_REQUIRED',
        status: 'INFO',
        message: `Human review and approval required before submission to ${jobRow.company}`,
        metadata: { preparationId: prepId },
      });
    }

    return this.getPreparationById(prepId, userId) as Promise<ApplicationPreparation>;
  }

  /**
   * Get preparation by ID with full questions and job
   */
  public static async getPreparationById(id: string, userId: string): Promise<ApplicationPreparation | null> {
    const prepRes = await pool.query(
      `SELECT p.*,
        row_to_json(j.*) as job_data,
        row_to_json(a.*) as app_data,
        row_to_json(tr.*) as tailored_resume_data,
        row_to_json(cl.*) as cover_letter_data
       FROM application_preparations p
       JOIN jobs j ON p.job_id = j.id
       JOIN applications a ON p.application_id = a.id
       LEFT JOIN tailored_resumes tr ON p.tailored_resume_id = tr.id
       LEFT JOIN cover_letters cl ON p.cover_letter_id = cl.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, userId]
    );

    if (prepRes.rows.length === 0) return null;
    const row = prepRes.rows[0];

    // Fetch questions
    const qRes = await pool.query(
      `SELECT * FROM application_questions WHERE application_preparation_id = $1 ORDER BY is_sensitive DESC, created_at ASC`,
      [id]
    );

    return this.mapPreparationRow(row, qRes.rows);
  }

  /**
   * List pending approval items
   */
  public static async listApprovalItems(
    userId: string,
    status?: PreparationStatus
  ): Promise<ApprovalItem[]> {
    let query = `
      SELECT p.*,
        row_to_json(j.*) as job_data,
        row_to_json(a.*) as app_data,
        row_to_json(tr.*) as tailored_resume_data,
        row_to_json(cl.*) as cover_letter_data
      FROM application_preparations p
      JOIN jobs j ON p.job_id = j.id
      JOIN applications a ON p.application_id = a.id
      LEFT JOIN tailored_resumes tr ON p.tailored_resume_id = tr.id
      LEFT JOIN cover_letters cl ON p.cover_letter_id = cl.id
      WHERE p.user_id = $1
    `;
    const params: any[] = [userId];

    if (status) {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    } else {
      query += ` AND p.status IN ('READY', 'NEEDS_USER_INPUT')`;
    }

    query += ` ORDER BY p.updated_at DESC`;

    const res = await pool.query(query, params);

    const items: ApprovalItem[] = [];
    for (const row of res.rows) {
      const qRes = await pool.query(
        `SELECT * FROM application_questions WHERE application_preparation_id = $1 ORDER BY is_sensitive DESC, created_at ASC`,
        [row.id]
      );
      const preparation = this.mapPreparationRow(row, qRes.rows);
      const questions = preparation.questions || [];
      const requiresUserInput = questions.some((q) => q.requiresUserInput && !q.candidateAnswer);

      items.push({
        preparation,
        application: preparation.application!,
        job: preparation.job!,
        tailoredResume: preparation.tailoredResume || null,
        coverLetter: preparation.coverLetter || null,
        questions,
        requiresUserInput,
      });
    }

    return items;
  }

  /**
   * Update answers for questions
   */
  public static async updateQuestionAnswers(
    preparationId: string,
    userId: string,
    answers: Record<string, string>
  ): Promise<ApplicationPreparation> {
    const prep = await this.getPreparationById(preparationId, userId);
    if (!prep) throw new Error('Application preparation not found');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [questionId, answer] of Object.entries(answers)) {
        await client.query(
          `UPDATE application_questions
           SET candidate_answer = $1, answer_source = 'USER_INPUT', confidence = 1.0, requires_user_input = false, updated_at = NOW()
           WHERE id = $2 AND application_preparation_id = $3`,
          [answer, questionId, preparationId]
        );
      }

      // Check if any required question remains unanswered
      const remainingRes = await client.query(
        `SELECT COUNT(*)::int as count FROM application_questions
         WHERE application_preparation_id = $1 AND requires_user_input = true AND (candidate_answer IS NULL OR candidate_answer = '')`,
        [preparationId]
      );

      const hasRemaining = (remainingRes.rows[0]?.count || 0) > 0;
      const newStatus = hasRemaining ? 'NEEDS_USER_INPUT' : 'READY';

      await client.query(
        `UPDATE application_preparations SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, preparationId]
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return (await this.getPreparationById(preparationId, userId))!;
  }

  /**
   * Approve an application preparation and proceed to submission or manual completion
   */
  public static async approveAndSubmit(
    preparationId: string,
    userId: string,
    notes?: string
  ): Promise<{
    submission: ApplicationSubmission | null;
    status: 'SUBMITTED' | 'REQUIRES_MANUAL_ACTION' | 'LIMIT_REACHED' | 'KILL_SWITCH_ACTIVE';
    message: string;
    externalUrl?: string;
  }> {
    const prep = await this.getPreparationById(preparationId, userId);
    if (!prep) throw new Error('Application preparation not found');

    // 1. Safety & Limits Check
    const limits = await AutomationService.checkApplicationLimits(userId);
    if (!limits.allowed) {
      if (limits.reason?.includes('Kill Switch')) {
        return {
          submission: null,
          status: 'KILL_SWITCH_ACTIVE',
          message: limits.reason,
        };
      }
      return {
        submission: null,
        status: 'LIMIT_REACHED',
        message: limits.reason || 'Application limits exceeded for today',
      };
    }

    const job = prep.job!;
    const jobSource = job.sourceId || (job as any).source || prep.source || 'unknown';
    const jobUrl = job.jobUrl || (job as any).url || '';
    const capabilities = sourceRegistry.getSourceCapabilities(jobSource);

    // 2. Check source capability
    if (capabilities.applicationMode === 'MANUAL_ONLY' || !capabilities.automatedApplicationAllowed) {
      // Source cannot be automatically submitted. Mark approved & advise manual apply
      await pool.query(
        `UPDATE application_preparations SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
        [preparationId]
      );

      await AutomationService.logAutomationEvent({
        userId,
        jobId: job.id,
        applicationId: prep.applicationId,
        eventType: 'APPLICATION_PREPARED',
        status: 'INFO',
        message: `Application approved for ${job.title}. Manual submission required per source policy for ${jobSource}.`,
        metadata: { url: jobUrl },
      });

      return {
        submission: null,
        status: 'REQUIRES_MANUAL_ACTION',
        message: `Source "${jobSource}" requires manual application submission on the company/job board portal. Application materials are prepared and ready.`,
        externalUrl: jobUrl,
      };
    }

    // 3. Automated submission via connector (e.g. Mock connector or enabled connector)
    const connector = sourceRegistry.getApplicationConnector(jobSource);
    if (!connector) {
      return {
        submission: null,
        status: 'REQUIRES_MANUAL_ACTION',
        message: `No submission connector found for source ${jobSource}. Please apply manually at the job link.`,
        externalUrl: jobUrl,
      };
    }

    try {
      const submitResult = await connector.submitApplication({
        jobId: job.id,
        applicationId: prep.applicationId,
        preparedAnswers: prep.preparedAnswers,
        tailoredResumeId: prep.tailoredResumeId,
        coverLetterId: prep.coverLetterId,
      });

      // Record in application_submissions
      const subRes = await pool.query(
        `INSERT INTO application_submissions (
          application_id, user_id, source, status,
          source_application_id, confirmation_url, confirmation_text, error, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [
          prep.applicationId,
          userId,
          jobSource,
          submitResult.status,
          submitResult.sourceApplicationId || null,
          submitResult.confirmationUrl || null,
          submitResult.confirmationText || null,
          submitResult.error || null,
        ]
      );

      // Update preparation status
      await pool.query(
        `UPDATE application_preparations SET status = 'SUBMITTED', updated_at = NOW() WHERE id = $1`,
        [preparationId]
      );

      // Update application status to APPLIED
      await ApplicationService.updateStatus(
        prep.applicationId,
        userId,
        'APPLIED',
        notes || 'Submitted via AI Job Hunter automated workflow'
      );

      // Log Event
      await AutomationService.logAutomationEvent({
        userId,
        jobId: job.id,
        applicationId: prep.applicationId,
        eventType: 'APPLICATION_SUBMITTED',
        status: submitResult.status === 'SUBMITTED' ? 'SUCCESS' : 'FAILED',
        message: `Application submitted to ${job.company} for ${job.title}`,
        metadata: {
          submissionId: subRes.rows[0].id,
          sourceApplicationId: submitResult.sourceApplicationId,
          confirmationUrl: submitResult.confirmationUrl,
        },
      });

      const submission: ApplicationSubmission = {
        id: subRes.rows[0].id,
        applicationId: prep.applicationId,
        userId,
        source: jobSource,
        status: subRes.rows[0].status,
        sourceApplicationId: subRes.rows[0].source_application_id,
        confirmationUrl: subRes.rows[0].confirmation_url,
        confirmationText: subRes.rows[0].confirmation_text,
        error: subRes.rows[0].error,
        submittedAt: subRes.rows[0].submitted_at,
      };

      return {
        submission,
        status: 'SUBMITTED',
        message: 'Application submitted successfully!',
        externalUrl: submitResult.confirmationUrl || undefined,
      };
    } catch (err: any) {
      logger.error(`Application submission error for preparation ${preparationId}:`, err.message);

      await pool.query(
        `UPDATE application_preparations SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [preparationId]
      );

      await AutomationService.logAutomationEvent({
        userId,
        jobId: job.id,
        applicationId: prep.applicationId,
        eventType: 'APPLICATION_FAILED',
        status: 'FAILED',
        message: `Submission failed: ${err.message}`,
        metadata: { error: err.message },
      });

      throw err;
    }
  }

  /**
   * Reject an application preparation
   */
  public static async rejectPreparation(
    preparationId: string,
    userId: string,
    reason?: string
  ): Promise<ApplicationPreparation> {
    const prep = await this.getPreparationById(preparationId, userId);
    if (!prep) throw new Error('Application preparation not found');

    await pool.query(
      `UPDATE application_preparations SET status = 'REJECTED', updated_at = NOW() WHERE id = $1`,
      [preparationId]
    );

    // Update application to rejected or removed
    await ApplicationService.updateStatus(
      prep.applicationId,
      userId,
      'REJECTED',
      reason ? `Rejected from approval queue: ${reason}` : 'Rejected from approval queue'
    );

    await AutomationService.logAutomationEvent({
      userId,
      jobId: prep.jobId,
      applicationId: prep.applicationId,
      eventType: 'JOB_EXCLUDED',
      status: 'INFO',
      message: `Application rejected for ${prep.job?.title || 'job'}: ${reason || 'User rejected approval'}`,
      metadata: { reason },
    });

    return (await this.getPreparationById(preparationId, userId))!;
  }

  // ==========================================
  // Private Row Mappers
  // ==========================================

  private static mapPreparationRow(row: any, questionRows: any[] = []): ApplicationPreparation {
    return {
      id: row.id,
      userId: row.user_id,
      applicationId: row.application_id,
      jobId: row.job_id,
      source: row.source,
      status: row.status,
      resumeId: row.resume_id,
      tailoredResumeId: row.tailored_resume_id,
      coverLetterId: row.cover_letter_id,
      preparedAnswers: typeof row.prepared_answers === 'string' ? JSON.parse(row.prepared_answers) : row.prepared_answers || {},
      missingAnswers: row.missing_answers || [],
      warnings: row.warnings || [],
      application: row.app_data,
      job: row.job_data,
      tailoredResume: row.tailored_resume_data,
      coverLetter: row.cover_letter_data,
      questions: questionRows.map((q) => ({
        id: q.id,
        applicationPreparationId: q.application_preparation_id,
        question: q.question,
        questionType: q.question_type,
        candidateAnswer: q.candidate_answer,
        answerSource: q.answer_source,
        confidence: parseFloat(q.confidence || '0'),
        requiresUserInput: q.requires_user_input,
        isSensitive: q.is_sensitive,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options || [],
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
