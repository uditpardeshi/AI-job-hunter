import crypto from 'crypto';
import { IJobSourceConnector } from '../types';
import { RawJob, JobSourceCapabilities, SourceCapabilities } from '@ai-job-hunter/shared';
import { logger } from '../../utils/logger';

export class HimalayasJobSource implements IJobSourceConnector {
  public readonly id = 'himalayas';
  public readonly name = 'Himalayas';
  public readonly capabilities: JobSourceCapabilities = {
    search: true,
    jobDetails: true,
    api: true,
    publicFeed: true,
    automatedCollection: true,
    automatedApplication: false,
    browserAutomation: false,
    applicationMode: 'MANUAL_ONLY',
    requiresHumanApproval: true,
  };

  private readonly endpoint = 'https://himalayas.app/jobs/api?limit=25';

  public getSourceCapabilities(): SourceCapabilities {
    return {
      jobSearch: true,
      jobDetails: true,
      apiAvailable: true,
      publicFeedAvailable: true,
      applicationUrlAvailable: true,
      automatedApplicationAllowed: false,
      browserAutomationAllowed: false,
      requiresAuthentication: false,
      requiresHumanApproval: true,
      applicationMode: 'MANUAL_ONLY',
    };
  }

  public async fetchJobs(_params?: Record<string, any>): Promise<RawJob[]> {
    logger.info(`Fetching jobs from Himalayas public API: ${this.endpoint}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(this.endpoint, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AIJobHunter/1.0 (Educational/Development Platform; contact: dev@aijobhunter.local)',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Himalayas API returned HTTP status ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const items: any[] = json.jobs || [];
      logger.info(`Himalayas returned ${items.length} job postings.`);

      return items.slice(0, 25).map((item: any) => {
        // Himalayas API uses 'guid' (a full URL) as the only stable job identifier.
        // There are no 'id' or 'slug' fields in the API response.
        // We use guid directly as sourceJobId to ensure deterministic deduplication.
        const jobUrl = item.applicationLink || item.guid || `https://himalayas.app/companies/${item.companySlug}/jobs`;
        const sourceJobId = item.guid
          ? item.guid
          : this.deterministicId(jobUrl, item.title || '', item.companyName || '');

        return {
          sourceJobId,
          title: item.title || 'Remote Engineer',
          company: item.companyName || 'Himalayas Employer',
          companyUrl: undefined,
          jobUrl,
          location: 'Remote',
          remoteType: 'remote',
          employmentType: 'full_time',
          description: item.description ? item.description.replace(/<[^>]*>?/gm, '').trim() : '',
          salaryMin: item.minSalary ? Number(item.minSalary) : undefined,
          salaryMax: item.maxSalary ? Number(item.maxSalary) : undefined,
          salaryCurrency: item.currency || 'USD',
          skills: Array.isArray(item.categories) ? item.categories : [],
          postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          rawData: item,
        };
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown network failure';
      logger.warn(`Himalayas fetch failed: ${errorMsg}. Falling back to empty list.`);
      return [];
    }
  }

  /**
   * Deterministic job ID using SHA-256 of stable normalized fields.
   * Used only when the source provides no stable primary identifier.
   * Same inputs always produce the same output — never uses randomness.
   */
  private deterministicId(url: string, title: string, company: string): string {
    const normalized = `${url.trim().toLowerCase()}|${title.trim().toLowerCase()}|${company.trim().toLowerCase()}`;
    return `himalayas-${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32)}`;
  }
}
