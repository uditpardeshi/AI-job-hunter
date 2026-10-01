import crypto from 'crypto';
import { IJobSourceConnector } from '../types';
import { RawJob, JobSourceCapabilities, SourceCapabilities } from '@ai-job-hunter/shared';
import { logger } from '../../utils/logger';

export class RemoteOKJobSource implements IJobSourceConnector {
  public readonly id = 'remoteok';
  public readonly name = 'RemoteOK';
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

  private readonly endpoint = 'https://remoteok.com/api';

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
    logger.info(`Fetching jobs from RemoteOK public API: ${this.endpoint}`);
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
        throw new Error(`RemoteOK API returned HTTP status ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      if (!Array.isArray(json)) {
        return [];
      }

      // First item in RemoteOK is a legal disclaimer/notice, so slice(1)
      const items = json.slice(1, 30);
      logger.info(`RemoteOK returned ${items.length} job postings.`);

      return items
        .filter((item: any) => item && (item.position || item.title))
        .map((item: any) => {
          const title = item.position || item.title || 'Remote Software Engineer';
          const company = item.company || 'Remote Company';
          const jobUrl = item.url || item.apply_url || `https://remoteok.com/remote-jobs/${item.id}`;
          const sourceJobId = item.id
            ? String(item.id)
            : (item.slug ? String(item.slug) : this.deterministicId(jobUrl, title, company));

          return {
            sourceJobId,
            title,
            company,
            companyUrl: item.company_logo ? undefined : undefined,
            jobUrl,
            location: item.location || 'Remote',
            remoteType: 'remote',
            employmentType: 'full_time',
            description: item.description ? item.description.replace(/<[^>]*>?/gm, '').trim() : '',
            salaryMin: item.salary_min ? Number(item.salary_min) : undefined,
            salaryMax: item.salary_max ? Number(item.salary_max) : undefined,
            salaryCurrency: 'USD',
            skills: Array.isArray(item.tags) ? item.tags : [],
            postedAt: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
            rawData: item,
          };
        });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown network failure';
      logger.warn(`RemoteOK fetch failed: ${errorMsg}. Falling back to empty list.`);
      return [];
    }
  }

  private deterministicId(url: string, title: string, company: string): string {
    const normalized = `${url.trim().toLowerCase()}|${title.trim().toLowerCase()}|${company.trim().toLowerCase()}`;
    return `remoteok-${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32)}`;
  }
}
