import { IJobSourceConnector } from '../types';
import { RawJob, JobSourceCapabilities, SourceCapabilities } from '@ai-job-hunter/shared';
import { logger } from '../../utils/logger';

export class ArbeitnowJobSource implements IJobSourceConnector {
  public readonly id = 'arbeitnow';
  public readonly name = 'Arbeitnow Jobs API';
  public readonly capabilities: JobSourceCapabilities = {
    search: true,
    jobDetails: true,
    api: true,
    publicFeed: true,
    automatedCollection: true,
  };

  private readonly endpoint = 'https://www.arbeitnow.com/api/job-board-api';

  public async fetchJobs(_params?: Record<string, any>): Promise<RawJob[]> {
    logger.info(`Fetching jobs from legitimate public API: ${this.endpoint}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(this.endpoint, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AIJobHunter/1.0 (Educational/Development Platform; contact: dev@aijobhunter.local)',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Arbeitnow API returned HTTP status ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const items: any[] = json.data || [];

      logger.info(`Arbeitnow API returned ${items.length} raw postings.`);

      return items.slice(0, 25).map((item) => {
        return {
          sourceJobId: item.slug || `arbeitnow-${item.created_at}-${Math.random().toString(36).substring(7)}`,
          title: item.title || 'Untitled Role',
          company: item.company_name || 'Confidential Company',
          jobUrl: item.url,
          location: item.location || (item.remote ? 'Remote' : 'Unspecified'),
          remoteType: item.remote ? 'remote' : 'onsite',
          employmentType: Array.isArray(item.job_types) && item.job_types.length > 0 ? item.job_types[0] : 'full_time',
          description: item.description ? item.description.replace(/<[^>]*>?/gm, '').trim() : '',
          skills: Array.isArray(item.tags) ? item.tags : [],
          postedAt: item.created_at ? new Date(item.created_at * 1000).toISOString() : new Date().toISOString(),
          rawData: item,
        };
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown network failure';
      logger.error(`Failed to fetch jobs from Arbeitnow: ${errorMsg}`);
      throw new Error(`Arbeitnow connector error: ${errorMsg}`);
    }
  }

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
}
