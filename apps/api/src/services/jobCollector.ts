import { pool } from '../db';
import { sourceRegistry } from '../connectors/registry';
import { JobNormalizer, NormalizedJobData } from './jobNormalizer';
import { JobDeduplicator } from './jobDeduplicator';
import { JobSyncResult } from '@ai-job-hunter/shared';
import { logger } from '../utils/logger';

export class JobCollector {
  private staleThresholdDays = parseInt(process.env.JOB_STALE_AFTER_DAYS || '14', 10);

  /**
   * Run synchronization across all enabled connectors (or a single specified source).
   */
  public async sync(targetSourceId?: string): Promise<JobSyncResult[]> {
    logger.info(`Starting job collection sync... targetSourceId=${targetSourceId || 'ALL'}`);

    const connectors = targetSourceId
      ? [sourceRegistry.getConnector(targetSourceId)].filter(Boolean)
      : await sourceRegistry.getEnabledConnectors();

    if (connectors.length === 0) {
      logger.warn(`No active connectors found to sync.`);
      return [];
    }

    const results: JobSyncResult[] = [];

    for (const connector of connectors) {
      if (!connector) continue;
      const result = await this.syncSource(connector);
      results.push(result);
    }

    // Clean up stale jobs after sync
    await this.markStaleJobs();

    return results;
  }

  /**
   * Sync a single connector with isolated error handling.
   */
  public async syncSource(connector: any): Promise<JobSyncResult> {
    const startedAt = new Date().toISOString();
    logger.info(`Syncing source: [${connector.id}] ${connector.name}...`);

    // 1. Initialize sync log
    const syncLogRes = await pool.query(
      `INSERT INTO job_source_syncs (source_id, started_at, status)
       VALUES ($1, $2, 'running')
       RETURNING id;`,
      [connector.id, startedAt]
    );
    const syncLogId = syncLogRes.rows[0].id;

    let jobsFound = 0;
    let jobsCreated = 0;
    let jobsUpdated = 0;
    let jobsSkipped = 0;

    try {
      // 2. Fetch raw jobs
      const rawJobs = await connector.fetchJobs();
      jobsFound = rawJobs.length;

      // 3. Process each job
      for (const raw of rawJobs) {
        if (!raw.title || !raw.company || !raw.sourceJobId) {
          jobsSkipped++;
          continue;
        }

        const normalized = JobNormalizer.normalize(raw);
        const outcome = await this.upsertJob(connector.id, normalized);

        if (outcome === 'created') jobsCreated++;
        else if (outcome === 'updated') jobsUpdated++;
        else jobsSkipped++;
      }

      // 4. Mark success in sync log and update source last_sync_at
      const completedAt = new Date().toISOString();
      await pool.query(
        `UPDATE job_source_syncs
         SET completed_at = $1, status = 'success', jobs_found = $2, jobs_created = $3, jobs_updated = $4, jobs_skipped = $5
         WHERE id = $6;`,
        [completedAt, jobsFound, jobsCreated, jobsUpdated, jobsSkipped, syncLogId]
      );

      await pool.query(
        `UPDATE job_sources SET last_sync_at = $1, updated_at = NOW() WHERE id = $2;`,
        [completedAt, connector.id]
      );

      logger.info(
        `Completed sync for [${connector.id}]: ${jobsFound} found, ${jobsCreated} created, ${jobsUpdated} updated, ${jobsSkipped} skipped.`
      );

      return {
        id: syncLogId,
        sourceId: connector.id,
        startedAt,
        completedAt,
        status: 'success',
        jobsFound,
        jobsCreated,
        jobsUpdated,
        jobsSkipped,
      };
    } catch (err: unknown) {
      // Error isolation: capture error, log, but do not throw so other sources can continue
      const errorMsg = err instanceof Error ? err.message : 'Unknown sync failure';
      logger.error(`Sync failure for [${connector.id}]: ${errorMsg}`);

      const completedAt = new Date().toISOString();
      await pool.query(
        `UPDATE job_source_syncs
         SET completed_at = $1, status = 'failed', error_message = $2, jobs_found = $3, jobs_created = $4, jobs_updated = $5, jobs_skipped = $6
         WHERE id = $7;`,
        [completedAt, errorMsg, jobsFound, jobsCreated, jobsUpdated, jobsSkipped, syncLogId]
      );

      return {
        id: syncLogId,
        sourceId: connector.id,
        startedAt,
        completedAt,
        status: 'failed',
        jobsFound,
        jobsCreated,
        jobsUpdated,
        jobsSkipped,
        errorMessage: errorMsg,
      };
    }
  }

  /**
   * Upsert a normalized job into PostgreSQL.
   */
  private async upsertJob(
    sourceId: string,
    job: NormalizedJobData
  ): Promise<'created' | 'updated' | 'skipped'> {
    // Level 1: Check if job already exists with same (source_id, source_job_id)
    const existingSameSource = await pool.query(
      'SELECT id, title, company, description, salary_min, salary_max FROM jobs WHERE source_id = $1 AND source_job_id = $2;',
      [sourceId, job.sourceJobId]
    );

    if (existingSameSource.rows.length > 0) {
      // Same source job exists: update last_seen_at and mutable fields
      const existing = existingSameSource.rows[0];
      await pool.query(
        `UPDATE jobs
         SET title = $1,
             company = $2,
             company_url = COALESCE($3, company_url),
             job_url = COALESCE($4, job_url),
             location = COALESCE($5, location),
             remote_type = $6,
             employment_type = $7,
             description = $8,
             salary_min = COALESCE($9, salary_min),
             salary_max = COALESCE($10, salary_max),
             salary_currency = COALESCE($11, salary_currency),
             experience_min = COALESCE($12, experience_min),
             experience_max = COALESCE($13, experience_max),
             skills = $14,
             raw_data = $15,
             status = 'active',
             last_seen_at = NOW(),
             updated_at = NOW()
         WHERE id = $16;`,
        [
          job.title,
          job.company,
          job.companyUrl,
          job.jobUrl,
          job.location,
          job.remoteType,
          job.employmentType,
          job.description,
          job.salaryMin,
          job.salaryMax,
          job.salaryCurrency,
          job.experienceMin,
          job.experienceMax,
          JSON.stringify(job.skills),
          JSON.stringify(job.rawData),
          existing.id,
        ]
      );
      return 'updated';
    }

    // Level 2: Cross-Source Deduplication Check
    const crossSourceMatchId = await JobDeduplicator.findCrossSourceDuplicate(sourceId, job);
    if (crossSourceMatchId) {
      // Found conservative cross-source duplicate: update existing job's last_seen_at and record cross-reference
      await pool.query(
        `UPDATE jobs
         SET last_seen_at = NOW(),
             raw_data = jsonb_set(raw_data, '{cross_source_refs}', COALESCE(raw_data->'cross_source_refs', '[]'::jsonb) || $1::jsonb)
         WHERE id = $2;`,
        [JSON.stringify([{ sourceId, sourceJobId: job.sourceJobId, timestamp: new Date().toISOString() }]), crossSourceMatchId]
      );
      return 'skipped';
    }

    // New Job: Insert into PostgreSQL
    await pool.query(
      `INSERT INTO jobs (
        source_id, source_job_id, title, company, company_url, job_url, location,
        remote_type, employment_type, description, salary_min, salary_max, salary_currency,
        experience_min, experience_max, posted_at, expires_at, skills, status, raw_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, 'active', $19
      );`,
      [
        sourceId,
        job.sourceJobId,
        job.title,
        job.company,
        job.companyUrl,
        job.jobUrl,
        job.location,
        job.remoteType,
        job.employmentType,
        job.description,
        job.salaryMin,
        job.salaryMax,
        job.salaryCurrency,
        job.experienceMin,
        job.experienceMax,
        job.postedAt,
        job.expiresAt,
        JSON.stringify(job.skills),
        JSON.stringify(job.rawData),
      ]
    );

    return 'created';
  }

  /**
   * Mark jobs as stale/expired if not seen within the threshold days.
   */
  public async markStaleJobs(): Promise<number> {
    const res = await pool.query(
      `UPDATE jobs
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'active'
         AND last_seen_at < NOW() - (INTERVAL '1 day' * $1)
       RETURNING id;`,
      [this.staleThresholdDays]
    );
    if (res.rows.length > 0) {
      logger.info(`Marked ${res.rows.length} jobs as expired (stale threshold: ${this.staleThresholdDays} days).`);
    }
    return res.rows.length;
  }
}

export const jobCollector = new JobCollector();
