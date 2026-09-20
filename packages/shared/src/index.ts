export type ServiceStatus = 'ok' | 'error' | 'connecting' | 'degraded';

export interface BaseHealthResponse {
  status: ServiceStatus;
  service: string;
  timestamp?: string;
  message?: string;
}

export interface ApiHealthResponse extends BaseHealthResponse {
  service: 'api';
  uptime?: number;
}

export interface AiHealthResponse extends BaseHealthResponse {
  service: 'ai';
}

export interface DbHealthResponse extends BaseHealthResponse {
  service: 'db';
  details?: {
    latencyMs?: number;
  };
}

export interface RedisHealthResponse extends BaseHealthResponse {
  service: 'redis';
  details?: {
    latencyMs?: number;
  };
}

export interface SystemHealthSummary {
  api: ApiHealthResponse;
  db: DbHealthResponse;
  redis: RedisHealthResponse;
  ai: AiHealthResponse;
}

// ==========================================
// Candidate & Resume Schemas (Step 2)
// ==========================================

export interface CandidateBasics {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
}

export interface ExperienceItem {
  company: string;
  title: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
  description: string[];
  skills: string[];
}

export interface EducationItem {
  institution: string;
  degree?: string | null;
  field?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  grade?: string | null;
}

export interface ProjectItem {
  name: string;
  description: string;
  url?: string | null;
  technologies: string[];
}

export interface CertificationItem {
  name: string;
  issuer?: string | null;
  date?: string | null;
  url?: string | null;
}

export interface CandidatePreferences {
  preferredRoles: string[];
  preferredLocations: string[];
  remotePreference: 'remote' | 'hybrid' | 'onsite' | 'any' | '';
  employmentTypes: ('full_time' | 'part_time' | 'contract' | 'internship')[];
  minimumSalary: number | null;
  maximumSalary: number | null;
  noticePeriod: string;
  preferredIndustries: string[];
}

export interface CandidateProfile {
  id?: string;
  userId?: string;
  basics: CandidateBasics;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  achievements: string[];
  preferences: CandidatePreferences;
  verificationStatus: 'needs_review' | 'verified';
  createdAt?: string;
  updatedAt?: string;
}

export type ResumeProcessingStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'parsing'
  | 'parsed'
  | 'needs_review'
  | 'verified'
  | 'failed';

export interface ResumeMetadata {
  id: string;
  userId: string;
  originalFilename: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  processingStatus: ResumeProcessingStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeVersion {
  id: string;
  userId: string;
  resumeId?: string | null;
  versionNumber: number;
  profileData: CandidateProfile;
  createdAt: string;
}

// ==========================================
// Job Collection Schemas (Step 3)
// ==========================================

export type JobStatus = 'active' | 'expired' | 'closed' | 'unknown';
export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'temporary'
  | 'unknown';

export interface Job {
  id: string;
  sourceId: string;
  sourceJobId: string;
  title: string;
  company: string;
  companyUrl?: string | null;
  jobUrl?: string | null;
  location?: string | null;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  description: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  postedAt?: string | null;
  expiresAt?: string | null;
  skills: string[];
  status: JobStatus;
  rawData?: Record<string, any>;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawJob {
  sourceJobId: string;
  title: string;
  company: string;
  companyUrl?: string;
  jobUrl?: string;
  location?: string;
  remoteType?: string;
  employmentType?: string;
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  experienceMin?: number;
  experienceMax?: number;
  postedAt?: string | Date;
  expiresAt?: string | Date;
  skills?: string[];
  rawData?: Record<string, any>;
}

export interface JobSourceCapabilities {
  search: boolean;
  jobDetails: boolean;
  api: boolean;
  publicFeed: boolean;
  automatedCollection: boolean;
}

export interface JobSourceConfig {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  apiAvailable: boolean;
  publicFeedAvailable: boolean;
  automatedCollectionAllowed: boolean;
  rateLimitDelayMs: number;
  lastSyncAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobSyncResult {
  id?: string;
  sourceId: string;
  startedAt: string;
  completedAt?: string | null;
  status: 'running' | 'success' | 'failed' | 'partial';
  jobsFound: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsSkipped: number;
  errorMessage?: string | null;
}

export interface JobSearchParams {
  q?: string;
  location?: string;
  remoteType?: RemoteType | '';
  employmentType?: EmploymentType | '';
  company?: string;
  source?: string;
  postedAfter?: string;
  postedBefore?: string;
  status?: JobStatus | '';
  page?: number;
  limit?: number;
  sortBy?: 'posted_at' | 'created_at';
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedJobsResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
