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
        const title = item.title || 'Remote Engineer';
        const company = item.companyName || 'Himalayas Employer';
        const jobUrl = item.applicationLink || item.guid || (item.companySlug && item.slug ? `https://himalayas.app/companies/${item.companySlug}/jobs/${item.slug}` : 'https://himalayas.app');
        
        // Himalayas uses 'guid' as its official unique job identifier
        const sourceJobId = item.guid
          ? String(item.guid)
          : this.deterministicId(jobUrl, title, company);

        let postedAtIso = new Date().toISOString();
        if (item.pubDate) {
          // pubDate is unix epoch seconds or ISO string
          const ts = typeof item.pubDate === 'number' ? item.pubDate * 1000 : Date.parse(item.pubDate);
          if (!isNaN(ts)) postedAtIso = new Date(ts).toISOString();
        } else if (item.createdAt) {
          const ts = Date.parse(item.createdAt);
          if (!isNaN(ts)) postedAtIso = new Date(ts).toISOString();
        }

        return {
          sourceJobId,
          title,
          company,
          companyUrl: item.companyWebsite || undefined,
          jobUrl,
          location: 'Remote',
          remoteType: 'remote',
          employmentType: 'full_time',
          description: item.description ? item.description.replace(/<[^>]*>?/gm, '').trim() : '',
          salaryMin: item.minSalary ? Number(item.minSalary) : undefined,
          salaryMax: item.maxSalary ? Number(item.maxSalary) : undefined,
          salaryCurrency: item.currency || 'USD',
          skills: Array.isArray(item.categories) ? item.categories : [],
          postedAt: postedAtIso,
          rawData: item,
        };
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown network failure';
      logger.warn(`Himalayas fetch failed: ${errorMsg}. Falling back to empty list.`);
      return [];
    }
  }

  private deterministicId(url: string, title: string, company: string): string {
    const normalized = `${url.trim().toLowerCase()}|${title.trim().toLowerCase()}|${company.trim().toLowerCase()}`;
    return `himalayas-${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32)}`;
  }
}
