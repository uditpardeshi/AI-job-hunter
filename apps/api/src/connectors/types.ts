import {
  JobSourceCapabilities,
  SourceCapabilities,
  SourceApplicationMode,
  RawJob,
  ApplicationPreparation,
} from '@ai-job-hunter/shared';

export interface IJobSourceConnector {
  id: string;
  name: string;
  capabilities: JobSourceCapabilities;
  getSourceCapabilities(): SourceCapabilities;
  fetchJobs(params?: Record<string, any>): Promise<RawJob[]>;
  searchJobs?(params: Record<string, any>): Promise<RawJob[]>;
  getJobDetails?(sourceJobId: string): Promise<RawJob | null>;
}

export interface ApplicationContext {
  userId?: string;
  applicationId: string;
  jobId: string;
  source?: string;
  preparation?: ApplicationPreparation;
  preparedAnswers?: Record<string, any>;
  tailoredResumeId?: string | null;
  coverLetterId?: string | null;
  candidateProfile?: any;
  settings?: any;
}

export interface ApplicationPreparationResult {
  status: 'READY' | 'NEEDS_USER_INPUT' | 'FAILED';
  preparedAnswers?: Record<string, any>;
  missingAnswers?: string[];
  warnings?: string[];
  questions?: Array<{
    question: string;
    questionType?: 'text' | 'number' | 'boolean' | 'choice' | 'sensitive';
    options?: string[];
  }>;
}

export interface ApplicationSubmissionResult {
  status: 'SUBMITTED' | 'REQUIRES_USER_ACTION' | 'BLOCKED' | 'FAILED' | 'UNKNOWN';
  sourceApplicationId?: string;
  confirmationUrl?: string;
  confirmationText?: string;
  error?: string;
}

export interface IApplicationConnector {
  canApply(): boolean;
  getApplicationMode(): SourceApplicationMode;
  prepareApplication(ctx: ApplicationContext): Promise<ApplicationPreparationResult>;
  submitApplication(ctx: ApplicationContext): Promise<ApplicationSubmissionResult>;
}
