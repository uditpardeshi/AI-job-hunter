import { pool } from '../db';
import { Job, JobSearchParams, PaginatedJobsResponse } from '@ai-job-hunter/shared';

export class JobService {
  /**
   * Search and filter jobs with database-level pagination.
   */
  public static async searchJobs(params: JobSearchParams): Promise<PaginatedJobsResponse> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // 1. Keyword search (q)
    if (params.q && params.q.trim()) {
      const kw = `%${params.q.trim()}%`;
      whereClauses.push(
        `(title ILIKE $${paramIndex} OR company ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
      );
      values.push(kw);
      paramIndex++;
    }

    // 2. Location
    if (params.location && params.location.trim()) {
      whereClauses.push(`location ILIKE $${paramIndex}`);
      values.push(`%${params.location.trim()}%`);
      paramIndex++;
    }

    // 3. Remote Type
    if (params.remoteType) {
      whereClauses.push(`remote_type = $${paramIndex}`);
      values.push(params.remoteType);
      paramIndex++;
    }

    // 4. Employment Type
    if (params.employmentType) {
      whereClauses.push(`employment_type = $${paramIndex}`);
      values.push(params.employmentType);
      paramIndex++;
    }

    // 5. Company
    if (params.company && params.company.trim()) {
      whereClauses.push(`company ILIKE $${paramIndex}`);
      values.push(`%${params.company.trim()}%`);
      paramIndex++;
    }

    // 6. Source
    if (params.source && params.source.trim()) {
      whereClauses.push(`source_id = $${paramIndex}`);
      values.push(params.source.trim());
      paramIndex++;
    }

    // 7. Status (default to 'active' if not specified)
    if (params.status && (params.status as string) !== '') {
      whereClauses.push(`status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }

    // 8. Posted Date Bounds
    if (params.postedAfter) {
      whereClauses.push(`posted_at >= $${paramIndex}`);
      values.push(new Date(params.postedAfter).toISOString());
      paramIndex++;
    }
    if (params.postedBefore) {
      whereClauses.push(`posted_at <= $${paramIndex}`);
      values.push(new Date(params.postedBefore).toISOString());
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let orderClause = 'ORDER BY j.posted_at DESC NULLS LAST, j.created_at DESC';
    const sortDir = params.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    if (params.sortBy === 'match') {
      orderClause = `ORDER BY jm.match_score ${sortDir} NULLS LAST, j.posted_at DESC NULLS LAST`;
    } else if (params.sortBy === 'created_at') {
      orderClause = `ORDER BY j.created_at ${sortDir} NULLS LAST`;
    } else if (params.sortBy === 'posted_at') {
      orderClause = `ORDER BY j.posted_at ${sortDir} NULLS LAST, j.created_at DESC`;
    }

    const sql = `
      SELECT 
        j.id, j.source_id, j.source_job_id, j.title, j.company, j.company_url, j.job_url, j.location,
        j.remote_type, j.employment_type, j.description, j.salary_min, j.salary_max, j.salary_currency,
        j.experience_min, j.experience_max, j.posted_at, j.expires_at, j.skills, j.status, j.raw_data,
        j.first_seen_at, j.last_seen_at, j.created_at, j.updated_at,
        jm.match_score, jm.matched_skills, jm.missing_required_skills,
        COUNT(*) OVER() AS total_count
      FROM jobs j
      LEFT JOIN candidate_profiles cp ON cp.user_id = '00000000-0000-0000-0000-000000000001'
      LEFT JOIN job_matches jm ON j.id = jm.job_id AND jm.candidate_id = cp.id
      ${whereSql}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    values.push(limit, offset);

    const res = await pool.query(sql, values);

    const total = res.rows.length > 0 ? Number(res.rows[0].total_count) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const jobs = res.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      sourceJobId: row.source_job_id,
      title: row.title,
      company: row.company,
      companyUrl: row.company_url,
      jobUrl: row.job_url,
      location: row.location,
      remoteType: row.remote_type,
      employmentType: row.employment_type,
      description: row.description,
      salaryMin: row.salary_min !== null ? Number(row.salary_min) : null,
      salaryMax: row.salary_max !== null ? Number(row.salary_max) : null,
      salaryCurrency: row.salary_currency,
      experienceMin: row.experience_min,
      experienceMax: row.experience_max,
      postedAt: row.posted_at,
      expiresAt: row.expires_at,
      skills: row.skills || [],
      status: row.status,
      rawData: row.raw_data,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      matchScore: row.match_score !== null && row.match_score !== undefined ? Number(row.match_score) : null,
      matchedSkills: row.matched_skills || [],
      missingRequiredSkills: row.missing_required_skills || [],
    }));

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single job by ID.
   */
  public static async getJobById(id: string): Promise<Job | null> {
    const res = await pool.query(
      `SELECT 
        id, source_id, source_job_id, title, company, company_url, job_url, location,
        remote_type, employment_type, description, salary_min, salary_max, salary_currency,
        experience_min, experience_max, posted_at, expires_at, skills, status, raw_data,
        first_seen_at, last_seen_at, created_at, updated_at
       FROM jobs
       WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    return {
      id: row.id,
      sourceId: row.source_id,
      sourceJobId: row.source_job_id,
      title: row.title,
      company: row.company,
      companyUrl: row.company_url,
      jobUrl: row.job_url,
      location: row.location,
      remoteType: row.remote_type,
      employmentType: row.employment_type,
      description: row.description,
      salaryMin: row.salary_min !== null ? Number(row.salary_min) : null,
      salaryMax: row.salary_max !== null ? Number(row.salary_max) : null,
      salaryCurrency: row.salary_currency,
      experienceMin: row.experience_min,
      experienceMax: row.experience_max,
      postedAt: row.posted_at,
      expiresAt: row.expires_at,
      skills: row.skills || [],
      status: row.status,
      rawData: row.raw_data,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get sync logs for a source.
   */
  public static async getSourceSyncs(sourceId: string, limit: number = 10): Promise<any[]> {
    const res = await pool.query(
      `SELECT id, source_id, started_at, completed_at, status, jobs_found, jobs_created, jobs_updated, jobs_skipped, error_message
       FROM job_source_syncs
       WHERE source_id = $1
       ORDER BY started_at DESC
       LIMIT $2;`,
      [sourceId, limit]
    );
    return res.rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      status: r.status,
      jobsFound: r.jobs_found,
      jobsCreated: r.jobs_created,
      jobsUpdated: r.jobs_updated,
      jobsSkipped: r.jobs_skipped,
      errorMessage: r.error_message,
    }));
  }
}
