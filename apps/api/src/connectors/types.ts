import { JobSourceCapabilities, RawJob } from '@ai-job-hunter/shared';

export interface IJobSourceConnector {
  id: string;
  name: string;
  capabilities: JobSourceCapabilities;
  fetchJobs(params?: Record<string, any>): Promise<RawJob[]>;
}
