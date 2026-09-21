import { pool } from '../db';
import {
  AutomationSettings,
  JobSearchProfile,
  AutomationRun,
  AutomationRunType,
  AutomationRunStatus,
  AutomationEvent,
  AutomationEventType,
  AutomationSummary,
  Job,
} from '@ai-job-hunter/shared';
import { logger } from '../utils/logger';

export class AutomationService {
  /**
   * Get user automation settings or initialize default
   */
  public static async getSettings(userId: string): Promise<AutomationSettings> {
    const res = await pool.query(
      `SELECT * FROM automation_settings WHERE user_id = $1`,
      [userId]
    );

    if (res.rows.length > 0) {
      return this.mapSettingsRow(res.rows[0]);
    }

    // Insert default
    const insertRes = await pool.query(
      `INSERT INTO automation_settings (
        user_id, automation_enabled, mode, sync_frequency_hours,
        auto_shortlisting_enabled, auto_tailoring_enabled, auto_cover_letter_enabled,
        application_approval_required, email_approval_required,
        browser_automation_enabled, daily_application_limit, hourly_application_limit,
        minimum_match_score, minimum_skill_match, kill_switch_active
      ) VALUES ($1, false, 'ASSISTED', 6, true, true, true, true, true, false, 5, 2, 80, 70, false)
      RETURNING *`,
      [userId]
    );

    return this.mapSettingsRow(insertRes.rows[0]);
  }

  /**
   * Update automation settings
   */
  public static async updateSettings(
    userId: string,
    updates: Partial<AutomationSettings>
  ): Promise<AutomationSettings> {
    const current = await this.getSettings(userId);

    const merged = {
      automationEnabled: updates.automationEnabled !== undefined ? updates.automationEnabled : current.automationEnabled,
      mode: updates.mode || current.mode,
      syncFrequencyHours: updates.syncFrequencyHours !== undefined ? updates.syncFrequencyHours : current.syncFrequencyHours,
      autoShortlistingEnabled: updates.autoShortlistingEnabled !== undefined ? updates.autoShortlistingEnabled : current.autoShortlistingEnabled,
      autoTailoringEnabled: updates.autoTailoringEnabled !== undefined ? updates.autoTailoringEnabled : current.autoTailoringEnabled,
      autoCoverLetterEnabled: updates.autoCoverLetterEnabled !== undefined ? updates.autoCoverLetterEnabled : current.autoCoverLetterEnabled,
      applicationApprovalRequired: updates.applicationApprovalRequired !== undefined ? updates.applicationApprovalRequired : current.applicationApprovalRequired,
      emailApprovalRequired: updates.emailApprovalRequired !== undefined ? updates.emailApprovalRequired : current.emailApprovalRequired,
      browserAutomationEnabled: updates.browserAutomationEnabled !== undefined ? updates.browserAutomationEnabled : current.browserAutomationEnabled,
      dailyApplicationLimit: updates.dailyApplicationLimit !== undefined ? updates.dailyApplicationLimit : current.dailyApplicationLimit,
      hourlyApplicationLimit: updates.hourlyApplicationLimit !== undefined ? updates.hourlyApplicationLimit : current.hourlyApplicationLimit,
      minimumMatchScore: updates.minimumMatchScore !== undefined ? updates.minimumMatchScore : current.minimumMatchScore,
      minimumSkillMatch: updates.minimumSkillMatch !== undefined ? updates.minimumSkillMatch : current.minimumSkillMatch,
      killSwitchActive: updates.killSwitchActive !== undefined ? updates.killSwitchActive : current.killSwitchActive,
    };

    const res = await pool.query(
      `UPDATE automation_settings SET
        automation_enabled = $1,
        mode = $2,
        sync_frequency_hours = $3,
        auto_shortlisting_enabled = $4,
        auto_tailoring_enabled = $5,
        auto_cover_letter_enabled = $6,
        application_approval_required = $7,
        email_approval_required = $8,
        browser_automation_enabled = $9,
        daily_application_limit = $10,
        hourly_application_limit = $11,
        minimum_match_score = $12,
        minimum_skill_match = $13,
        kill_switch_active = $14,
        updated_at = NOW()
      WHERE user_id = $15
      RETURNING *`,
      [
        merged.automationEnabled,
        merged.mode,
        merged.syncFrequencyHours,
        merged.autoShortlistingEnabled,
        merged.autoTailoringEnabled,
        merged.autoCoverLetterEnabled,
        merged.applicationApprovalRequired,
        merged.emailApprovalRequired,
        merged.browserAutomationEnabled,
        merged.dailyApplicationLimit,
        merged.hourlyApplicationLimit,
        merged.minimumMatchScore,
        merged.minimumSkillMatch,
        merged.killSwitchActive,
        userId,
      ]
    );

    return this.mapSettingsRow(res.rows[0]);
  }

  /**
   * Trigger emergency kill switch - immediately pauses all active automations
   */
  public static async triggerKillSwitch(userId: string, reason?: string): Promise<AutomationSettings> {
    const res = await pool.query(
      `UPDATE automation_settings SET
        kill_switch_active = true,
        automation_enabled = false,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *`,
      [userId]
    );

    await this.logAutomationEvent({
      userId,
      eventType: 'KILL_SWITCH_TRIGGERED',
      status: 'WARNING',
      message: `Emergency Kill Switch Activated: ${reason || 'User initiated emergency halt'}`,
      metadata: { reason, timestamp: new Date().toISOString() },
    });

    logger.warn(`Kill switch triggered for user ${userId}: ${reason}`);
    return this.mapSettingsRow(res.rows[0]);
  }

  /**
   * Resume automation after kill switch
   */
  public static async resumeKillSwitch(userId: string): Promise<AutomationSettings> {
    const res = await pool.query(
      `UPDATE automation_settings SET
        kill_switch_active = false,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *`,
      [userId]
    );

    await this.logAutomationEvent({
      userId,
      eventType: 'KILL_SWITCH_TRIGGERED',
      status: 'INFO',
      message: 'Emergency Kill Switch Deactivated: Normal operations resumed',
      metadata: { timestamp: new Date().toISOString() },
    });

    return this.mapSettingsRow(res.rows[0]);
  }

  /**
   * Check if rate limits or kill switch prevent new applications
   */
  public static async checkApplicationLimits(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    todayCount: number;
    hourCount: number;
    dailyLimit: number;
    hourlyLimit: number;
  }> {
    const settings = await this.getSettings(userId);

    if (settings.killSwitchActive) {
      return {
        allowed: false,
        reason: 'Emergency Kill Switch is currently active',
        todayCount: 0,
        hourCount: 0,
        dailyLimit: settings.dailyApplicationLimit,
        hourlyLimit: settings.hourlyApplicationLimit,
      };
    }

    const todayRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM application_submissions
       WHERE user_id = $1 AND submitted_at >= NOW() - INTERVAL '24 hours' AND status = 'SUBMITTED'`,
      [userId]
    );
    const hourRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM application_submissions
       WHERE user_id = $1 AND submitted_at >= NOW() - INTERVAL '1 hour' AND status = 'SUBMITTED'`,
      [userId]
    );

    const todayCount = todayRes.rows[0]?.count || 0;
    const hourCount = hourRes.rows[0]?.count || 0;

    if (todayCount >= settings.dailyApplicationLimit) {
      return {
        allowed: false,
        reason: `Daily application limit reached (${todayCount}/${settings.dailyApplicationLimit})`,
        todayCount,
        hourCount,
        dailyLimit: settings.dailyApplicationLimit,
        hourlyLimit: settings.hourlyApplicationLimit,
      };
    }

    if (hourCount >= settings.hourlyApplicationLimit) {
      return {
        allowed: false,
        reason: `Hourly application limit reached (${hourCount}/${settings.hourlyApplicationLimit})`,
        todayCount,
        hourCount,
        dailyLimit: settings.dailyApplicationLimit,
        hourlyLimit: settings.hourlyApplicationLimit,
      };
    }

    return {
      allowed: true,
      todayCount,
      hourCount,
      dailyLimit: settings.dailyApplicationLimit,
      hourlyLimit: settings.hourlyApplicationLimit,
    };
  }

  // ==========================================
  // Job Search Profiles
  // ==========================================

  public static async listSearchProfiles(userId: string): Promise<JobSearchProfile[]> {
    const res = await pool.query(
      `SELECT * FROM job_search_profiles WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map(this.mapSearchProfileRow);
  }

  public static async getSearchProfile(id: string, userId: string): Promise<JobSearchProfile | null> {
    const res = await pool.query(
      `SELECT * FROM job_search_profiles WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return res.rows.length > 0 ? this.mapSearchProfileRow(res.rows[0]) : null;
  }

  public static async createSearchProfile(
    userId: string,
    data: Partial<JobSearchProfile>
  ): Promise<JobSearchProfile> {
    const res = await pool.query(
      `INSERT INTO job_search_profiles (
        user_id, candidate_id, name, roles, skills, locations,
        remote_types, employment_types, experience_min, experience_max,
        salary_min, salary_currency, industries, sources,
        minimum_match_score, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        userId,
        data.candidateId || null,
        data.name || 'Default Search Profile',
        data.roles || [],
        data.skills || [],
        data.locations || [],
        data.remoteTypes || [],
        data.employmentTypes || [],
        data.experienceMin || null,
        data.experienceMax || null,
        data.salaryMin || null,
        data.salaryCurrency || 'USD',
        data.industries || [],
        data.sources || [],
        data.minimumMatchScore || 80,
        data.enabled !== undefined ? data.enabled : true,
      ]
    );
    return this.mapSearchProfileRow(res.rows[0]);
  }

  public static async updateSearchProfile(
    id: string,
    userId: string,
    data: Partial<JobSearchProfile>
  ): Promise<JobSearchProfile | null> {
    const existing = await this.getSearchProfile(id, userId);
    if (!existing) return null;

    const res = await pool.query(
      `UPDATE job_search_profiles SET
        name = COALESCE($1, name),
        roles = COALESCE($2, roles),
        skills = COALESCE($3, skills),
        locations = COALESCE($4, locations),
        remote_types = COALESCE($5, remote_types),
        employment_types = COALESCE($6, employment_types),
        experience_min = $7,
        experience_max = $8,
        salary_min = $9,
        salary_currency = COALESCE($10, salary_currency),
        industries = COALESCE($11, industries),
        sources = COALESCE($12, sources),
        minimum_match_score = COALESCE($13, minimum_match_score),
        enabled = COALESCE($14, enabled),
        updated_at = NOW()
      WHERE id = $15 AND user_id = $16
      RETURNING *`,
      [
        data.name,
        data.roles,
        data.skills,
        data.locations,
        data.remoteTypes,
        data.employmentTypes,
        data.experienceMin !== undefined ? data.experienceMin : existing.experienceMin,
        data.experienceMax !== undefined ? data.experienceMax : existing.experienceMax,
        data.salaryMin !== undefined ? data.salaryMin : existing.salaryMin,
        data.salaryCurrency,
        data.industries,
        data.sources,
        data.minimumMatchScore,
        data.enabled,
        id,
        userId,
      ]
    );

    return res.rows.length > 0 ? this.mapSearchProfileRow(res.rows[0]) : null;
  }

  public static async deleteSearchProfile(id: string, userId: string): Promise<boolean> {
    const res = await pool.query(
      `DELETE FROM job_search_profiles WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Evaluate a job against active search profiles to determine if it should be shortlisted
   */
  public static evaluateJobAgainstProfiles(
    job: Job,
    matchScore: number,
    profiles: JobSearchProfile[]
  ): {
    shouldShortlist: boolean;
    reasons: string[];
    matchedProfile?: JobSearchProfile;
  } {
    const activeProfiles = profiles.filter((p) => p.enabled);
    if (activeProfiles.length === 0) {
      // If no profile configured, shortlist if score >= 80
      return {
        shouldShortlist: matchScore >= 80,
        reasons: matchScore >= 80 ? ['Match score >= 80% default threshold'] : ['Score below default 80% threshold'],
      };
    }

    for (const profile of activeProfiles) {
      const reasons: string[] = [];

      // 1. Match score check
      if (matchScore < profile.minimumMatchScore) {
        continue;
      }
      reasons.push(`Match score ${matchScore}% meets requirement (${profile.minimumMatchScore}%)`);

      // 2. Role keyword check (if profile has roles specified)
      if (profile.roles && profile.roles.length > 0) {
        const title = job.title.toLowerCase();
        const roleMatches = profile.roles.some((r) => title.includes(r.toLowerCase()));
        if (!roleMatches) continue;
        reasons.push(`Title matches target role (${profile.roles.join(', ')})`);
      }

      // 3. Location / Remote type check
      if (profile.remoteTypes && profile.remoteTypes.length > 0) {
        const jobRemote = (job.remoteType || '').toLowerCase();
        const remoteMatches = profile.remoteTypes.some((rt) => jobRemote.includes(rt.toLowerCase()));
        if (!remoteMatches) continue;
        reasons.push(`Remote preference matched (${job.remoteType})`);
      }

      // 4. Source check
      const jobSource = job.sourceId || (job as any).source || '';
      if (profile.sources && profile.sources.length > 0) {
        const sourceMatches = profile.sources.includes(jobSource);
        if (!sourceMatches) continue;
        reasons.push(`Job source allowed (${jobSource})`);
      }

      // 5. Salary check
      if (profile.salaryMin && job.salaryMax) {
        if (job.salaryMax < profile.salaryMin) continue;
        reasons.push(`Salary range acceptable (up to ${job.salaryMax} ${job.salaryCurrency || 'USD'})`);
      }

      return {
        shouldShortlist: true,
        reasons,
        matchedProfile: profile,
      };
    }

    return {
      shouldShortlist: false,
      reasons: ['Job did not meet criteria of any active search profile'],
    };
  }

  // ==========================================
  // Automation Runs & Events Tracking
  // ==========================================

  public static async startAutomationRun(
    userId: string,
    runType: AutomationRunType,
    metadata?: Record<string, any>
  ): Promise<AutomationRun> {
    const res = await pool.query(
      `INSERT INTO automation_runs (user_id, run_type, status, metadata)
       VALUES ($1, $2, 'RUNNING', $3)
       RETURNING *`,
      [userId, runType, JSON.stringify(metadata || {})]
    );
    return this.mapRunRow(res.rows[0]);
  }

  public static async updateAutomationRun(
    runId: string,
    updates: Partial<AutomationRun>
  ): Promise<AutomationRun | null> {
    const res = await pool.query(
      `UPDATE automation_runs SET
        status = COALESCE($1, status),
        items_processed = COALESCE($2, items_processed),
        items_succeeded = COALESCE($3, items_succeeded),
        items_failed = COALESCE($4, items_failed),
        error_summary = COALESCE($5, error_summary),
        completed_at = CASE WHEN $1 IN ('COMPLETED', 'FAILED', 'PARTIAL', 'CANCELLED') THEN NOW() ELSE completed_at END,
        metadata = COALESCE($6, metadata)
      WHERE id = $7
      RETURNING *`,
      [
        updates.status,
        updates.itemsProcessed,
        updates.itemsSucceeded,
        updates.itemsFailed,
        updates.errorSummary,
        updates.metadata ? JSON.stringify(updates.metadata) : null,
        runId,
      ]
    );

    return res.rows.length > 0 ? this.mapRunRow(res.rows[0]) : null;
  }

  public static async logAutomationEvent(
    event: Omit<AutomationEvent, 'id' | 'createdAt'>
  ): Promise<AutomationEvent> {
    const res = await pool.query(
      `INSERT INTO automation_events (
        automation_run_id, user_id, candidate_id, job_id, application_id,
        event_type, status, message, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        event.automationRunId || null,
        event.userId,
        event.candidateId || null,
        event.jobId || null,
        event.applicationId || null,
        event.eventType,
        event.status || 'SUCCESS',
        event.message,
        JSON.stringify(event.metadata || {}),
      ]
    );

    return this.mapEventRow(res.rows[0]);
  }

  public static async listAutomationRuns(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ runs: AutomationRun[]; total: number }> {
    const offset = (page - 1) * limit;
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM automation_runs WHERE user_id = $1`,
      [userId]
    );
    const runsRes = await pool.query(
      `SELECT * FROM automation_runs WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      runs: runsRes.rows.map(this.mapRunRow),
      total: countRes.rows[0]?.count || 0,
    };
  }

  public static async getAutomationRun(runId: string, userId: string): Promise<AutomationRun | null> {
    const res = await pool.query(
      `SELECT * FROM automation_runs WHERE id = $1 AND user_id = $2`,
      [runId, userId]
    );
    return res.rows.length > 0 ? this.mapRunRow(res.rows[0]) : null;
  }

  public static async listAutomationEvents(
    userId: string,
    runId?: string,
    limit: number = 50
  ): Promise<AutomationEvent[]> {
    let query = `SELECT * FROM automation_events WHERE user_id = $1`;
    const params: any[] = [userId];

    if (runId) {
      params.push(runId);
      query += ` AND automation_run_id = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const res = await pool.query(query, params);
    return res.rows.map(this.mapEventRow);
  }

  /**
   * Get complete automation summary for dashboard and command center
   */
  public static async getAutomationSummary(userId: string): Promise<AutomationSummary> {
    const settings = await this.getSettings(userId);

    const profilesRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM job_search_profiles WHERE user_id = $1 AND enabled = true`,
      [userId]
    );
    const activeProfilesCount = profilesRes.rows[0]?.count || 0;

    // Today's statistics
    const statsRes = await pool.query(
      `SELECT
        COUNT(CASE WHEN event_type = 'JOB_DISCOVERED' THEN 1 END)::int as jobs_discovered,
        COUNT(CASE WHEN event_type = 'JOB_ANALYZED' THEN 1 END)::int as jobs_analyzed,
        COUNT(CASE WHEN event_type = 'JOB_MATCHED' THEN 1 END)::int as jobs_matched,
        COUNT(CASE WHEN event_type = 'JOB_SHORTLISTED' THEN 1 END)::int as jobs_shortlisted,
        COUNT(CASE WHEN event_type = 'APPLICATION_PREPARED' THEN 1 END)::int as applications_prepared,
        COUNT(CASE WHEN event_type = 'APPLICATION_SUBMITTED' THEN 1 END)::int as applications_submitted
       FROM automation_events
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    // Pending approvals count
    const pendingRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM application_preparations
       WHERE user_id = $1 AND status IN ('READY', 'NEEDS_USER_INPUT')`,
      [userId]
    );

    // Last run
    const lastRunRes = await pool.query(
      `SELECT * FROM automation_runs WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );

    // Recent events
    const recentEvents = await this.listAutomationEvents(userId, undefined, 20);

    const stats = statsRes.rows[0] || {};

    return {
      settings,
      activeProfilesCount,
      todayStats: {
        jobsDiscovered: stats.jobs_discovered || 0,
        jobsAnalyzed: stats.jobs_analyzed || 0,
        jobsMatched: stats.jobs_matched || 0,
        jobsShortlisted: stats.jobs_shortlisted || 0,
        applicationsPrepared: stats.applications_prepared || 0,
        applicationsSubmitted: stats.applications_submitted || 0,
        pendingApprovals: pendingRes.rows[0]?.count || 0,
      },
      lastRun: lastRunRes.rows.length > 0 ? this.mapRunRow(lastRunRes.rows[0]) : null,
      recentEvents,
      killSwitchActive: settings.killSwitchActive,
    };
  }

  // ==========================================
  // Private Row Mappers
  // ==========================================

  private static mapSettingsRow(row: any): AutomationSettings {
    return {
      id: row.id,
      userId: row.user_id,
      automationEnabled: row.automation_enabled,
      mode: row.mode,
      syncFrequencyHours: row.sync_frequency_hours,
      autoShortlistingEnabled: row.auto_shortlisting_enabled,
      autoTailoringEnabled: row.auto_tailoring_enabled,
      autoCoverLetterEnabled: row.auto_cover_letter_enabled,
      applicationApprovalRequired: row.application_approval_required,
      emailApprovalRequired: row.email_approval_required,
      browserAutomationEnabled: row.browser_automation_enabled,
      dailyApplicationLimit: row.daily_application_limit,
      hourlyApplicationLimit: row.hourly_application_limit,
      minimumMatchScore: row.minimum_match_score,
      minimumSkillMatch: row.minimum_skill_match,
      killSwitchActive: row.kill_switch_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapSearchProfileRow(row: any): JobSearchProfile {
    return {
      id: row.id,
      userId: row.user_id,
      candidateId: row.candidate_id,
      name: row.name,
      roles: row.roles || [],
      skills: row.skills || [],
      locations: row.locations || [],
      remoteTypes: row.remote_types || [],
      employmentTypes: row.employment_types || [],
      experienceMin: row.experience_min,
      experienceMax: row.experience_max,
      salaryMin: row.salary_min ? parseFloat(row.salary_min) : null,
      salaryCurrency: row.salary_currency,
      industries: row.industries || [],
      sources: row.sources || [],
      minimumMatchScore: row.minimum_match_score,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapRunRow(row: any): AutomationRun {
    return {
      id: row.id,
      userId: row.user_id,
      candidateId: row.candidate_id,
      runType: row.run_type,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      itemsProcessed: row.items_processed || 0,
      itemsSucceeded: row.items_succeeded || 0,
      itemsFailed: row.items_failed || 0,
      errorSummary: row.error_summary,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      createdAt: row.created_at,
    };
  }

  private static mapEventRow(row: any): AutomationEvent {
    return {
      id: row.id,
      automationRunId: row.automation_run_id,
      userId: row.user_id,
      candidateId: row.candidate_id,
      jobId: row.job_id,
      applicationId: row.application_id,
      eventType: row.event_type,
      status: row.status,
      message: row.message,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      createdAt: row.created_at,
    };
  }
}
