import { pool } from '../db';
import { NormalizedJobData } from './jobNormalizer';
import { logger } from '../utils/logger';

export class JobDeduplicator {
  /**
   * Normalize company name for conservative duplicate comparison.
   * Strips corporate suffixes like Inc, LLC, Ltd, Corp, Group.
   */
  public static cleanCompanyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|corporation|group|technologies|solutions|holdings|co)\b\.?/gi, '')
      .replace(/[^a-z0-9]/gi, '')
      .trim();
  }

  /**
   * Normalize title for comparison.
   */
  public static cleanTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[\(\[\{].*?[\)\]\}]/g, '') // remove parenthetical like (Hybrid)
      .replace(/[^a-z0-9]/gi, '')
      .trim();
  }

  /**
   * Check if a cross-source match exists in the database.
   * Returns existing job ID if high-confidence cross-source duplicate, else null.
   */
  public static async findCrossSourceDuplicate(
    sourceId: string,
    job: NormalizedJobData
  ): Promise<string | null> {
    const cleanCompany = this.cleanCompanyName(job.company);
    const cleanTitle = this.cleanTitle(job.title);

    if (!cleanCompany || !cleanTitle || cleanCompany.length < 3 || cleanTitle.length < 4) {
      // Too ambiguous to deduce cross-source duplicate safely
      return null;
    }

    // Exact URL match is 100% duplicate even across sources
    if (job.jobUrl) {
      const urlRes = await pool.query(
        'SELECT id FROM jobs WHERE job_url = $1 AND source_id != $2 LIMIT 1;',
        [job.jobUrl, sourceId]
      );
      if (urlRes.rows.length > 0) {
        logger.info(`Cross-source exact URL duplicate found: ${job.jobUrl}`);
        return urlRes.rows[0].id;
      }
    }

    // Query active jobs from other sources with matching company & title
    const query = `
      SELECT id, company, title, location, remote_type
      FROM jobs
      WHERE source_id != $1
        AND status = 'active'
        AND LOWER(company) LIKE $2
        AND LOWER(title) LIKE $3
      LIMIT 5;
    `;

    const res = await pool.query(query, [
      sourceId,
      `%${job.company.toLowerCase().slice(0, 5)}%`,
      `%${job.title.toLowerCase().slice(0, 8)}%`,
    ]);

    for (const candidate of res.rows) {
      const candCleanCompany = this.cleanCompanyName(candidate.company);
      const candCleanTitle = this.cleanTitle(candidate.title);

      if (candCleanCompany === cleanCompany && candCleanTitle === cleanTitle) {
        // Verify location / remote compatibility
        const locationMatches =
          !job.location ||
          !candidate.location ||
          job.location.toLowerCase() === candidate.location.toLowerCase() ||
          job.remoteType === candidate.remote_type;

        if (locationMatches) {
          logger.info(
            `Cross-source duplicate identified: "${job.title}" at "${job.company}" matches existing job ${candidate.id}`
          );
          return candidate.id;
        }
      }
    }

    return null;
  }
}
