import { pool } from '../db';
import { logger } from '../utils/logger';
import {
  Application,
  ApplicationStatus,
  ApplicationEvent,
  ApplicationSearchParams,
} from '@ai-job-hunter/shared';

export class ApplicationService {
  /**
   * Create an application for candidate and job.
   * Prevents duplicate active applications for the same candidate + job.
   */
  public static async createApplication(
    userId: string,
    data: {
      jobId: string;
      status?: ApplicationStatus;
      resumeId?: string | null;
      tailoredResumeId?: string | null;
      coverLetterId?: string | null;
      externalApplicationUrl?: string | null;
      nextFollowUpAt?: string | null;
      notes?: string | null;
    }
  ): Promise<Application> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        jobId,
        status = 'SAVED',
        resumeId = null,
        tailoredResumeId = null,
        coverLetterId = null,
        externalApplicationUrl = null,
        nextFollowUpAt = null,
        notes = null,
      } = data;

      // 1. Verify job exists
      const jobRes = await client.query('SELECT id, title, company FROM jobs WHERE id = $1', [jobId]);
      if (jobRes.rows.length === 0) {
        throw new Error(`Job not found with ID ${jobId}`);
      }
      const job = jobRes.rows[0];

      // 2. Fetch candidate profile if available
      const profRes = await client.query(
        'SELECT id FROM candidate_profiles WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      const candidateId = profRes.rows.length > 0 ? profRes.rows[0].id : null;

      // 3. Prevent duplicate active applications
      const dupRes = await client.query(
        `SELECT id, status FROM applications 
         WHERE user_id = $1 AND job_id = $2 AND status != 'WITHDRAWN' 
         LIMIT 1`,
        [userId, jobId]
      );
      if (dupRes.rows.length > 0) {
        const existing = dupRes.rows[0];
        const error: any = new Error(
          `An active application already exists for ${job.title} at ${job.company} with status "${existing.status}".`
        );
        error.statusCode = 409;
        error.existingApplicationId = existing.id;
        throw error;
      }

      // 4. Validate materials if referenced
      if (resumeId) {
        const rCheck = await client.query(
          'SELECT id FROM resumes WHERE id = $1 AND user_id = $2',
          [resumeId, userId]
        );
        if (rCheck.rows.length === 0) {
          throw new Error('Referenced base resume does not belong to the user.');
        }
      }

      if (tailoredResumeId) {
        const trCheck = await client.query(
          'SELECT id, job_id FROM tailored_resumes WHERE id = $1 AND user_id = $2',
          [tailoredResumeId, userId]
        );
        if (trCheck.rows.length === 0) {
          throw new Error('Referenced tailored resume does not belong to the user.');
        }
      }

      if (coverLetterId) {
        const clCheck = await client.query(
          'SELECT id, job_id FROM cover_letters WHERE id = $1 AND user_id = $2',
          [coverLetterId, userId]
        );
        if (clCheck.rows.length === 0) {
          throw new Error('Referenced cover letter does not belong to the user.');
        }
      }

      // 5. Determine initial stage timestamps
      const now = new Date().toISOString();
      const savedAt = status === 'SAVED' ? now : null;
      const shortlistedAt = status === 'SHORTLISTED' ? now : null;
      const readyAt = status === 'READY' ? now : null;
      const appliedAt = status === 'APPLIED' ? now : null;

      // 6. Insert application record
      const insertRes = await client.query(
        `
        INSERT INTO applications (
          user_id, candidate_id, job_id, status,
          saved_at, shortlisted_at, ready_at, applied_at,
          last_updated_at, next_follow_up_at, external_application_url,
          resume_id, tailored_resume_id, cover_letter_id, notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17
        ) RETURNING *;
        `,
        [
          userId,
          candidateId,
          jobId,
          status,
          savedAt,
          shortlistedAt,
          readyAt,
          appliedAt,
          now,
          nextFollowUpAt,
          externalApplicationUrl,
          resumeId,
          tailoredResumeId,
          coverLetterId,
          notes,
          now,
          now,
        ]
      );

      const appRow = insertRes.rows[0];
      const appId = appRow.id;

      // 7. Record initial timeline event
      await client.query(
        `
        INSERT INTO application_events (
          application_id, event_type, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5);
        `,
        [
          appId,
          'APPLICATION_CREATED',
          `Application created with status ${status}`,
          JSON.stringify({ initialStatus: status, jobId, jobTitle: job.title, company: job.company }),
          now,
        ]
      );

      if (tailoredResumeId) {
        await client.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            appId,
            'RESUME_ATTACHED',
            'Tailored resume attached to application',
            JSON.stringify({ tailoredResumeId }),
            now,
          ]
        );
      }

      if (coverLetterId) {
        await client.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            appId,
            'COVER_LETTER_ATTACHED',
            'Cover letter attached to application',
            JSON.stringify({ coverLetterId }),
            now,
          ]
        );
      }

      if (notes) {
        await client.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            appId,
            'NOTE_ADDED',
            'Initial note recorded',
            JSON.stringify({ notePreview: notes.slice(0, 100) }),
            now,
          ]
        );
      }

      if (nextFollowUpAt) {
        await client.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            appId,
            'FOLLOW_UP_SCHEDULED',
            `Follow-up scheduled for ${new Date(nextFollowUpAt).toLocaleDateString()}`,
            JSON.stringify({ nextFollowUpAt }),
            now,
          ]
        );
      }

      await client.query('COMMIT');
      const createdApp = await this.getApplicationById(appId, userId);
      return createdApp || this.mapApplicationRow(appRow);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * List applications for candidate with filtering, searching, and pagination.
   */
  public static async listApplications(
    userId: string,
    params: ApplicationSearchParams
  ): Promise<{
    applications: Application[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['a.user_id = $1'];
    const values: any[] = [userId];
    let valIdx = 2;

    if (params.jobId) {
      whereClauses.push(`a.job_id = $${valIdx++}`);
      values.push(params.jobId);
    }

    if (params.status) {
      whereClauses.push(`a.status = $${valIdx++}`);
      values.push(params.status);
    }

    if (params.company) {
      whereClauses.push(`j.company ILIKE $${valIdx++}`);
      values.push(`%${params.company}%`);
    }

    if (params.jobTitle) {
      whereClauses.push(`j.title ILIKE $${valIdx++}`);
      values.push(`%${params.jobTitle}%`);
    }

    if (params.location) {
      whereClauses.push(`j.location ILIKE $${valIdx++}`);
      values.push(`%${params.location}%`);
    }

    if (params.remoteType) {
      whereClauses.push(`j.remote_type = $${valIdx++}`);
      values.push(params.remoteType);
    }

    if (params.source) {
      whereClauses.push(`j.source_id = $${valIdx++}`);
      values.push(params.source);
    }

    if (params.hasFollowUp === true) {
      whereClauses.push(`a.next_follow_up_at IS NOT NULL`);
    }

    if (params.search) {
      whereClauses.push(
        `(j.title ILIKE $${valIdx} OR j.company ILIKE $${valIdx} OR a.notes ILIKE $${valIdx})`
      );
      values.push(`%${params.search}%`);
      valIdx++;
    }

    const whereSql = whereClauses.join(' AND ');

    // Sort order
    let sortColumn = 'a.last_updated_at';
    if (params.sortBy === 'applied_at') sortColumn = 'a.applied_at';
    if (params.sortBy === 'created_at') sortColumn = 'a.created_at';
    if (params.sortBy === 'next_follow_up_at') sortColumn = 'a.next_follow_up_at';
    if (params.sortBy === 'company') sortColumn = 'j.company';

    const sortOrder = params.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Count query
    const countRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE ${whereSql};
      `,
      values
    );
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Data query with job and match score enrichment
    const listRes = await pool.query(
      `
      SELECT 
        a.*,
        j.title AS job_title,
        j.company AS job_company,
        j.location AS job_location,
        j.remote_type AS job_remote_type,
        j.employment_type AS job_employment_type,
        j.salary_min AS job_salary_min,
        j.salary_max AS job_salary_max,
        j.salary_currency AS job_salary_currency,
        j.job_url AS job_external_url,
        j.source_id AS job_source_id,
        j.status AS job_status,
        jm.match_score,
        tr.title AS tailored_resume_title,
        tr.version_number AS tailored_resume_version,
        cl.title AS cover_letter_title,
        cl.tone AS cover_letter_tone
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN candidate_profiles cp ON a.user_id = cp.user_id
      LEFT JOIN job_matches jm ON jm.job_id = a.job_id AND jm.candidate_id = cp.id
      LEFT JOIN tailored_resumes tr ON tr.id = a.tailored_resume_id
      LEFT JOIN cover_letters cl ON cl.id = a.cover_letter_id
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
      LIMIT $${valIdx++} OFFSET $${valIdx++};
      `,
      [...values, limit, offset]
    );

    const applications = listRes.rows.map((row) => this.mapApplicationRowWithJob(row));

    return {
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single application by ID with full job, match, materials, and chronological timeline.
   */
  public static async getApplicationById(id: string, userId: string): Promise<Application | null> {
    const appRes = await pool.query(
      `
      SELECT 
        a.*,
        j.title AS job_title,
        j.company AS job_company,
        j.location AS job_location,
        j.remote_type AS job_remote_type,
        j.employment_type AS job_employment_type,
        j.salary_min AS job_salary_min,
        j.salary_max AS job_salary_max,
        j.salary_currency AS job_salary_currency,
        j.description AS job_description,
        j.job_url AS job_external_url,
        j.source_id AS job_source_id,
        j.status AS job_status,
        jm.match_score,
        jm.components AS match_components,
        jm.strengths AS match_strengths,
        jm.concerns AS match_concerns,
        jm.missing_required_skills,
        jm.missing_preferred_skills,
        jm.explanation AS match_explanation,
        tr.title AS tailored_resume_title,
        tr.version_number AS tailored_resume_version,
        tr.ats_analysis AS tailored_resume_ats,
        cl.title AS cover_letter_title,
        cl.tone AS cover_letter_tone,
        cl.content AS cover_letter_content
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN candidate_profiles cp ON a.user_id = cp.user_id
      LEFT JOIN job_matches jm ON jm.job_id = a.job_id AND jm.candidate_id = cp.id
      LEFT JOIN tailored_resumes tr ON tr.id = a.tailored_resume_id
      LEFT JOIN cover_letters cl ON cl.id = a.cover_letter_id
      WHERE a.id = $1 AND a.user_id = $2;
      `,
      [id, userId]
    );

    if (appRes.rows.length === 0) {
      return null;
    }

    const row = appRes.rows[0];

    // Fetch chronological timeline events
    const eventsRes = await pool.query(
      `
      SELECT id, application_id, event_type, description, metadata, created_at
      FROM application_events
      WHERE application_id = $1
      ORDER BY created_at DESC, id DESC;
      `,
      [id]
    );

    const events: ApplicationEvent[] = eventsRes.rows.map((e) => ({
      id: e.id,
      applicationId: e.application_id,
      eventType: e.event_type,
      description: e.description,
      metadata: e.metadata,
      createdAt: e.created_at?.toISOString() || e.created_at,
    }));

    return this.mapApplicationRowWithJobAndEvents(row, events);
  }

  /**
   * Update application status and set respective stage timestamp.
   * Records STATUS_CHANGED event on the timeline.
   */
  public static async updateStatus(
    id: string,
    userId: string,
    newStatus: ApplicationStatus,
    reason?: string
  ): Promise<Application> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const appRes = await client.query(
        'SELECT * FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId]
      );
      if (appRes.rows.length === 0) {
        throw new Error('Application not found');
      }

      const current = appRes.rows[0];
      const previousStatus = current.status;
      const now = new Date().toISOString();

      if (previousStatus === newStatus) {
        await client.query('COMMIT');
        return this.mapApplicationRow(current);
      }

      // Preserve existing timestamps, set timestamp for new stage if null
      const savedAt = newStatus === 'SAVED' ? current.saved_at || now : current.saved_at;
      const shortlistedAt = newStatus === 'SHORTLISTED' ? current.shortlisted_at || now : current.shortlisted_at;
      const readyAt = newStatus === 'READY' ? current.ready_at || now : current.ready_at;
      const appliedAt = newStatus === 'APPLIED' ? current.applied_at || now : current.applied_at;
      const interviewAt = newStatus === 'INTERVIEW' ? current.interview_at || now : current.interview_at;
      const offerAt = newStatus === 'OFFER' ? current.offer_at || now : current.offer_at;
      const rejectedAt = newStatus === 'REJECTED' ? current.rejected_at || now : current.rejected_at;
      const withdrawnAt = newStatus === 'WITHDRAWN' ? current.withdrawn_at || now : current.withdrawn_at;

      const updateRes = await client.query(
        `
        UPDATE applications
        SET status = $1,
            saved_at = $2,
            shortlisted_at = $3,
            ready_at = $4,
            applied_at = $5,
            interview_at = $6,
            offer_at = $7,
            rejected_at = $8,
            withdrawn_at = $9,
            last_updated_at = $10,
            updated_at = $10
        WHERE id = $11 AND user_id = $12
        RETURNING *;
        `,
        [
          newStatus,
          savedAt,
          shortlistedAt,
          readyAt,
          appliedAt,
          interviewAt,
          offerAt,
          rejectedAt,
          withdrawnAt,
          now,
          id,
          userId,
        ]
      );

      // Record timeline event
      await client.query(
        `
        INSERT INTO application_events (
          application_id, event_type, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5);
        `,
        [
          id,
          'STATUS_CHANGED',
          `Status changed from ${previousStatus} to ${newStatus}`,
          JSON.stringify({ previousStatus, newStatus, reason: reason || null }),
          now,
        ]
      );

      await client.query('COMMIT');
      return this.mapApplicationRow(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update or clear follow-up date.
   */
  public static async updateFollowUp(
    id: string,
    userId: string,
    nextFollowUpAt: string | null,
    isCompleted?: boolean
  ): Promise<Application> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const appRes = await client.query(
        'SELECT * FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId]
      );
      if (appRes.rows.length === 0) {
        throw new Error('Application not found');
      }

      const now = new Date().toISOString();
      const updateRes = await client.query(
        `
        UPDATE applications
        SET next_follow_up_at = $1,
            last_updated_at = $2,
            updated_at = $2
        WHERE id = $3 AND user_id = $4
        RETURNING *;
        `,
        [nextFollowUpAt, now, id, userId]
      );

      if (isCompleted) {
        await client.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            id,
            'FOLLOW_UP_COMPLETED',
            'Follow-up marked as completed',
            JSON.stringify({ completedAt: now }),
            now,
          ]
        );
      } else if (nextFollowUpAt) {
        await client.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            id,
            'FOLLOW_UP_SCHEDULED',
            `Next follow-up scheduled for ${new Date(nextFollowUpAt).toLocaleDateString()}`,
            JSON.stringify({ nextFollowUpAt }),
            now,
          ]
        );
      }

      await client.query('COMMIT');
      return this.mapApplicationRow(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Add a free-form note to the application and record timeline event.
   */
  public static async addNote(id: string, userId: string, noteText: string): Promise<Application> {
    if (!noteText || !noteText.trim()) {
      throw new Error('Note text cannot be empty');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const appRes = await client.query(
        'SELECT * FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId]
      );
      if (appRes.rows.length === 0) {
        throw new Error('Application not found');
      }

      const current = appRes.rows[0];
      const now = new Date().toISOString();
      const dateHeader = `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]`;
      const combinedNotes = current.notes
        ? `${current.notes}\n\n${dateHeader}\n${noteText.trim()}`
        : `${dateHeader}\n${noteText.trim()}`;

      const updateRes = await client.query(
        `
        UPDATE applications
        SET notes = $1,
            last_updated_at = $2,
            updated_at = $2
        WHERE id = $3 AND user_id = $4
        RETURNING *;
        `,
        [combinedNotes, now, id, userId]
      );

      await client.query(
        `
        INSERT INTO application_events (
          application_id, event_type, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5);
        `,
        [
          id,
          'NOTE_ADDED',
          noteText.trim(),
          JSON.stringify({ addedAt: now, noteLength: noteText.trim().length }),
          now,
        ]
      );

      await client.query('COMMIT');
      return this.mapApplicationRow(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update application materials (tailored resume, cover letter, base resume) or external URL.
   */
  public static async updateApplication(
    id: string,
    userId: string,
    updates: {
      tailoredResumeId?: string | null;
      coverLetterId?: string | null;
      resumeId?: string | null;
      externalApplicationUrl?: string | null;
      notes?: string | null;
    }
  ): Promise<Application> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const appRes = await client.query(
        'SELECT * FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId]
      );
      if (appRes.rows.length === 0) {
        throw new Error('Application not found');
      }

      const current = appRes.rows[0];
      const now = new Date().toISOString();

      if (updates.tailoredResumeId !== undefined && updates.tailoredResumeId !== null) {
        const trCheck = await client.query(
          'SELECT id FROM tailored_resumes WHERE id = $1 AND user_id = $2',
          [updates.tailoredResumeId, userId]
        );
        if (trCheck.rows.length === 0) {
          throw new Error('Referenced tailored resume does not belong to user.');
        }
      }

      if (updates.coverLetterId !== undefined && updates.coverLetterId !== null) {
        const clCheck = await client.query(
          'SELECT id FROM cover_letters WHERE id = $1 AND user_id = $2',
          [updates.coverLetterId, userId]
        );
        if (clCheck.rows.length === 0) {
          throw new Error('Referenced cover letter does not belong to user.');
        }
      }

      const tailoredResumeId =
        updates.tailoredResumeId !== undefined ? updates.tailoredResumeId : current.tailored_resume_id;
      const coverLetterId =
        updates.coverLetterId !== undefined ? updates.coverLetterId : current.cover_letter_id;
      const resumeId = updates.resumeId !== undefined ? updates.resumeId : current.resume_id;
      const externalApplicationUrl =
        updates.externalApplicationUrl !== undefined
          ? updates.externalApplicationUrl
          : current.external_application_url;
      const notes = updates.notes !== undefined ? updates.notes : current.notes;

      const updateRes = await client.query(
        `
        UPDATE applications
        SET tailored_resume_id = $1,
            cover_letter_id = $2,
            resume_id = $3,
            external_application_url = $4,
            notes = $5,
            last_updated_at = $6,
            updated_at = $6
        WHERE id = $7 AND user_id = $8
        RETURNING *;
        `,
        [tailoredResumeId, coverLetterId, resumeId, externalApplicationUrl, notes, now, id, userId]
      );

      // Check if material changed to record timeline event
      if (updates.tailoredResumeId !== undefined && updates.tailoredResumeId !== current.tailored_resume_id) {
        await client.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            id,
            'MATERIAL_CHANGED',
            'Tailored resume updated on application',
            JSON.stringify({ oldId: current.tailored_resume_id, newId: updates.tailoredResumeId }),
            now,
          ]
        );
      }

      if (updates.coverLetterId !== undefined && updates.coverLetterId !== current.cover_letter_id) {
        await client.query(
          `
          INSERT INTO application_events (
            application_id, event_type, description, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5);
          `,
          [
            id,
            'MATERIAL_CHANGED',
            'Cover letter updated on application',
            JSON.stringify({ oldId: current.cover_letter_id, newId: updates.coverLetterId }),
            now,
          ]
        );
      }

      await client.query('COMMIT');
      return this.mapApplicationRow(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Delete an application.
   */
  public static async deleteApplication(id: string, userId: string): Promise<boolean> {
    const res = await pool.query(
      'DELETE FROM applications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return res.rows.length > 0;
  }

  /**
   * Get application events for timeline.
   */
  public static async getTimeline(id: string, userId: string): Promise<ApplicationEvent[]> {
    // Validate ownership
    const appCheck = await pool.query(
      'SELECT id FROM applications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (appCheck.rows.length === 0) {
      throw new Error('Application not found');
    }

    const res = await pool.query(
      `
      SELECT id, application_id, event_type, description, metadata, created_at
      FROM application_events
      WHERE application_id = $1
      ORDER BY created_at DESC, id DESC;
      `,
      [id]
    );

    return res.rows.map((e) => ({
      id: e.id,
      applicationId: e.application_id,
      eventType: e.event_type,
      description: e.description,
      metadata: e.metadata,
      createdAt: e.created_at?.toISOString() || e.created_at,
    }));
  }

  // Row mapping helpers
  private static mapApplicationRow(row: any): Application {
    return {
      id: row.id,
      userId: row.user_id,
      candidateId: row.candidate_id,
      jobId: row.job_id,
      status: row.status,
      savedAt: row.saved_at?.toISOString() || row.saved_at,
      shortlistedAt: row.shortlisted_at?.toISOString() || row.shortlisted_at,
      readyAt: row.ready_at?.toISOString() || row.ready_at,
      appliedAt: row.applied_at?.toISOString() || row.applied_at,
      interviewAt: row.interview_at?.toISOString() || row.interview_at,
      offerAt: row.offer_at?.toISOString() || row.offer_at,
      rejectedAt: row.rejected_at?.toISOString() || row.rejected_at,
      withdrawnAt: row.withdrawn_at?.toISOString() || row.withdrawn_at,
      lastUpdatedAt: row.last_updated_at?.toISOString() || row.last_updated_at,
      nextFollowUpAt: row.next_follow_up_at?.toISOString() || row.next_follow_up_at,
      externalApplicationUrl: row.external_application_url,
      resumeId: row.resume_id,
      tailoredResumeId: row.tailored_resume_id,
      coverLetterId: row.cover_letter_id,
      notes: row.notes,
      createdAt: row.created_at?.toISOString() || row.created_at,
      updatedAt: row.updated_at?.toISOString() || row.updated_at,
    };
  }

  private static mapApplicationRowWithJob(row: any): Application {
    const base = this.mapApplicationRow(row);
    base.job = {
      id: row.job_id,
      sourceId: row.job_source_id || '',
      sourceJobId: '',
      title: row.job_title || '',
      company: row.job_company || '',
      location: row.job_location || '',
      remoteType: row.job_remote_type || 'onsite',
      employmentType: row.job_employment_type || 'full_time',
      description: '',
      skills: [],
      jobUrl: row.job_external_url || '',
      status: row.job_status || 'active',
      firstSeenAt: '',
      lastSeenAt: '',
      createdAt: '',
      updatedAt: '',
    };

    if (row.match_score !== null && row.match_score !== undefined) {
      base.match = {
        jobId: row.job_id,
        candidateId: row.candidate_id || '',
        matchScore: Number(row.match_score),
        components: {
          skillMatch: 0,
          roleMatch: 0,
          experienceMatch: 0,
          semanticMatch: 0,
          locationMatch: 0,
          preferenceMatch: 0,
        },
        matchedSkills: [],
        missingRequiredSkills: [],
        missingPreferredSkills: [],
        strengths: [],
        concerns: [],
        explanation: '',
        modelVersion: '',
        scoringVersion: '',
      };
    }

    if (row.tailored_resume_title) {
      base.tailoredResume = {
        id: row.tailored_resume_id,
        userId: row.user_id,
        jobId: row.job_id,
        versionNumber: row.tailored_resume_version,
        title: row.tailored_resume_title,
        resumeData: {} as any,
        tailoringChanges: {} as any,
        atsAnalysis: row.tailored_resume_ats || ({} as any),
        validationFlags: [],
        status: 'completed',
        modelVersion: '',
        createdAt: '',
        updatedAt: '',
      };
    }

    if (row.cover_letter_title) {
      base.coverLetter = {
        id: row.cover_letter_id,
        userId: row.user_id,
        jobId: row.job_id,
        versionNumber: 1,
        title: row.cover_letter_title,
        content: '',
        tone: row.cover_letter_tone,
        modelVersion: '',
        createdAt: '',
        updatedAt: '',
      };
    }

    return base;
  }

  private static mapApplicationRowWithJobAndEvents(row: any, events: ApplicationEvent[]): Application {
    const base = this.mapApplicationRowWithJob(row);
    if (row.job_description) {
      base.job!.description = row.job_description;
    }
    if (row.match_score !== null && row.match_score !== undefined) {
      base.match = {
        jobId: row.job_id,
        candidateId: row.candidate_id || '',
        matchScore: Number(row.match_score),
        components: row.match_components || {
          skillMatch: 0,
          roleMatch: 0,
          experienceMatch: 0,
          semanticMatch: 0,
          locationMatch: 0,
          preferenceMatch: 0,
        },
        matchedSkills: [],
        missingRequiredSkills: row.missing_required_skills || [],
        missingPreferredSkills: row.missing_preferred_skills || [],
        strengths: row.match_strengths || [],
        concerns: row.match_concerns || [],
        explanation: row.match_explanation || '',
        modelVersion: '',
        scoringVersion: '',
      };
    }
    if (row.cover_letter_content && base.coverLetter) {
      base.coverLetter.content = row.cover_letter_content;
    }
    base.events = events;
    return base;
  }
}
