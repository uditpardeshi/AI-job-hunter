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

export type SourceApplicationMode = 'AUTOMATED' | 'HUMAN_APPROVAL_REQUIRED' | 'MANUAL_ONLY' | 'UNSUPPORTED';

export interface JobSourceCapabilities {
  search: boolean;
  jobDetails: boolean;
  api: boolean;
  publicFeed: boolean;
  automatedCollection: boolean;
  automatedApplication?: boolean;
  browserAutomation?: boolean;
  applicationMode?: SourceApplicationMode;
  requiresHumanApproval?: boolean;
}

export interface SourceCapabilities {
  jobSearch: boolean;
  jobDetails: boolean;
  apiAvailable: boolean;
  publicFeedAvailable: boolean;
  applicationUrlAvailable: boolean;
  automatedApplicationAllowed: boolean;
  browserAutomationAllowed: boolean;
  requiresAuthentication: boolean;
  requiresHumanApproval: boolean;
  applicationMode: SourceApplicationMode;
}

export interface JobSourceConfig {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  apiAvailable: boolean;
  publicFeedAvailable: boolean;
  automatedCollectionAllowed: boolean;
  automatedApplicationAllowed?: boolean;
  browserAutomationAllowed?: boolean;
  applicationMode?: SourceApplicationMode;
  requiresHumanApproval?: boolean;
  requiresAuthentication?: boolean;
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
  sortBy?: 'posted_at' | 'created_at' | 'match';
  sortOrder?: 'ASC' | 'DESC';
  candidateId?: string;
}

export interface PaginatedJobsResponse {
  jobs: (Job & {
    matchScore?: number | null;
    matchedSkills?: string[];
    missingRequiredSkills?: string[];
  })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==========================================
// AI Job Matching Schemas (Step 4)
// ==========================================

export interface JobAnalysis {
  id?: string;
  jobId: string;
  role: string;
  seniority: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  educationRequirements: string[];
  experienceMin: number | null;
  experienceMax: number | null;
  remoteType: RemoteType;
  modelUsed: string;
  analyzedAt?: string;
}

export interface MatchComponents {
  skillMatch: number;
  roleMatch: number;
  experienceMatch: number;
  semanticMatch: number;
  locationMatch: number;
  preferenceMatch: number;
}

export interface JobMatchResult {
  id?: string;
  jobId: string;
  candidateId: string;
  matchScore: number;
  components: MatchComponents;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  strengths: string[];
  concerns: string[];
  explanation: string;
  modelVersion: string;
  scoringVersion: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==========================================
// Resume Tailoring & Cover Letters (Step 5)
// ==========================================

export interface TailoredResumeHeader {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface TailoredExperienceItem {
  company: string;
  title: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
  bullets: string[];
}

export interface TailoredProjectItem {
  name: string;
  description: string;
  technologies: string[];
  url?: string | null;
}

export interface TailoredResumeData {
  header: TailoredResumeHeader;
  summary: string;
  skills: string[];
  experience: TailoredExperienceItem[];
  projects: TailoredProjectItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  achievements: string[];
}

export interface TailoringChanges {
  emphasized: string[];
  reordered: string[];
  deemphasized: string[];
  notAdded: string[];
}

export interface AtsAnalysisResult {
  alignmentScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  formattingIssues: string[];
  recommendations: string[];
}

export interface ValidationFlag {
  type: 'unsupported_skill' | 'unsupported_employer' | 'unsupported_title' | 'unsupported_credential' | 'suspicious_metric';
  item: string;
  message: string;
  resolved?: boolean;
}

export type TailoredResumeStatus = 'queued' | 'processing' | 'completed' | 'needs_review' | 'failed';

export interface TailoredResume {
  id: string;
  userId: string;
  jobId: string;
  baseResumeId?: string | null;
  versionNumber: number;
  title: string;
  resumeData: TailoredResumeData;
  tailoringChanges: TailoringChanges;
  atsAnalysis: AtsAnalysisResult;
  validationFlags: ValidationFlag[];
  status: TailoredResumeStatus;
  instructions?: string | null;
  modelVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetter {
  id: string;
  userId: string;
  jobId: string;
  baseResumeId?: string | null;
  versionNumber: number;
  title: string;
  content: string;
  tone: 'professional' | 'conversational' | 'enthusiastic';
  instructions?: string | null;
  modelVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeGenerationRun {
  id: string;
  userId: string;
  jobId: string;
  baseResumeId?: string | null;
  type: 'tailor_resume' | 'cover_letter';
  status: 'processing' | 'completed' | 'failed';
  modelVersion: string;
  promptVersion: string;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
}

// ==========================================
// Dashboard + Application Tracker (Step 6)
// ==========================================

export type ApplicationStatus =
  | 'SAVED'
  | 'SHORTLISTED'
  | 'READY'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED'
  | 'WITHDRAWN';

export type ApplicationEventType =
  | 'APPLICATION_CREATED'
  | 'STATUS_CHANGED'
  | 'RESUME_ATTACHED'
  | 'COVER_LETTER_ATTACHED'
  | 'NOTE_ADDED'
  | 'FOLLOW_UP_SCHEDULED'
  | 'FOLLOW_UP_COMPLETED'
  | 'MATERIAL_CHANGED'
  | 'APPLICATION_EMAIL_RECEIVED'
  | 'EMAIL_SENT';

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  eventType: ApplicationEventType;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Application {
  id: string;
  userId: string;
  candidateId?: string | null;
  jobId: string;
  status: ApplicationStatus;
  savedAt?: string | null;
  shortlistedAt?: string | null;
  readyAt?: string | null;
  appliedAt?: string | null;
  interviewAt?: string | null;
  offerAt?: string | null;
  rejectedAt?: string | null;
  withdrawnAt?: string | null;
  lastUpdatedAt: string;
  nextFollowUpAt?: string | null;
  externalApplicationUrl?: string | null;
  resumeId?: string | null;
  tailoredResumeId?: string | null;
  coverLetterId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated relations when requested
  job?: Job;
  match?: JobMatchResult | null;
  tailoredResume?: TailoredResume | null;
  coverLetter?: CoverLetter | null;
  events?: ApplicationEvent[];
}

export interface ApplicationSearchParams {
  jobId?: string;
  status?: ApplicationStatus | '';
  company?: string;
  jobTitle?: string;
  location?: string;
  remoteType?: string;
  source?: string;
  hasFollowUp?: boolean;
  search?: string;
  sortBy?: 'last_updated_at' | 'applied_at' | 'created_at' | 'next_follow_up_at' | 'company';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface DashboardStats {
  jobsFound: number;
  saved: number;
  shortlisted: number;
  ready: number;
  applied: number;
  interviews: number;
  offers: number;
  rejected: number;
  withdrawn: number;
}

export interface DashboardAnalytics {
  applicationsOverTime: { date: string; count: number }[];
  applicationsByStatus: { status: ApplicationStatus; count: number }[];
  totalTracked: number;
  interviewCount: number;
  offerCount: number;
  interviewRate: number; // percentage (interviews / applied)
  offerRate: number;     // percentage (offers / applied)
}

export interface DashboardData {
  stats: DashboardStats;
  recentApplications: Application[];
  upcomingFollowUps: Application[];
  recentJobs: (Job & { matchScore?: number | null; applicationStatus?: ApplicationStatus | null })[];
  analytics: DashboardAnalytics;
}

// ==========================================
// Step 7: Email & Application Assistant
// ==========================================

export type EmailCategory =
  | 'JOB_OPPORTUNITY'
  | 'APPLICATION_CONFIRMATION'
  | 'RECRUITER_MESSAGE'
  | 'INTERVIEW_INVITATION'
  | 'INTERVIEW_UPDATE'
  | 'ASSESSMENT'
  | 'REJECTION'
  | 'OFFER'
  | 'FOLLOW_UP'
  | 'OTHER';

export type EmailDirection = 'INBOUND' | 'OUTBOUND';

export type EmailPurpose =
  | 'APPLICATION_FOLLOW_UP'
  | 'RECRUITER_REPLY'
  | 'INTERVIEW_CONFIRMATION'
  | 'INTERVIEW_RESCHEDULE'
  | 'THANK_YOU'
  | 'APPLICATION_STATUS_QUERY'
  | 'OFFER_RESPONSE'
  | 'GENERAL_RECRUITER_REPLY'
  | 'CUSTOM';

export type EmailTone = 'professional' | 'concise' | 'friendly' | 'formal';

export type DraftStatus = 'DRAFT' | 'READY_TO_SEND' | 'SENT' | 'DISCARDED';

export interface GmailConnection {
  id: string;
  userId: string;
  candidateId?: string | null;
  emailAddress: string;
  scopes: string[];
  isConnected: boolean;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  userId: string;
  candidateId?: string | null;
  applicationId?: string | null;
  gmailMessageId: string;
  threadId?: string | null;
  sender: string;
  senderEmail: string;
  senderName?: string | null;
  recipient: string;
  cc: string[];
  subject: string;
  snippet?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  direction: EmailDirection;
  category: EmailCategory;
  confidence: number;
  suggestedStatus?: ApplicationStatus | null;
  statusSuggestionHandled: boolean;
  requiresResponse: boolean;
  isRead: boolean;
  receivedAt: string;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  application?: Application | null;
}

export interface EmailAttachment {
  id: string;
  name: string;
  type: string; // 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  size: number;
  sourceType: 'base_resume' | 'tailored_resume' | 'cover_letter' | 'custom';
  sourceId?: string | null;
}

export interface EmailDraft {
  id: string;
  userId: string;
  applicationId?: string | null;
  replyToEmailId?: string | null;
  purpose: EmailPurpose;
  tone: EmailTone;
  recipient: string;
  cc: string[];
  subject: string;
  body: string;
  attachments: EmailAttachment[];
  status: DraftStatus;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationContact {
  id: string;
  applicationId: string;
  name: string;
  email: string;
  role?: string | null;
  company?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailClassificationResult {
  category: EmailCategory;
  confidence: number;
  jobTitle?: string | null;
  company?: string | null;
  suggestedStatus?: ApplicationStatus | null;
  requiresResponse: boolean;
  summary?: string | null;
}

export interface GeneratedEmailDraft {
  subject: string;
  body: string;
  purpose: EmailPurpose;
  warnings: string[];
}

export interface SendEmailRequest {
  applicationId?: string | null;
  draftId?: string | null;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

export interface EmailSearchParams {
  category?: EmailCategory | '';
  applicationId?: string;
  direction?: EmailDirection;
  isRead?: boolean;
  requiresResponse?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// Step 8: Automation + Real AI Job Hunter
// ==========================================

export type AutomationMode = 'MANUAL' | 'ASSISTED' | 'APPROVAL_REQUIRED' | 'AUTOMATIC_WHERE_PERMITTED';

export interface AutomationSettings {
  id: string;
  userId: string;
  automationEnabled: boolean;
  mode: AutomationMode;
  syncFrequencyHours: number;
  autoShortlistingEnabled: boolean;
  autoTailoringEnabled: boolean;
  autoCoverLetterEnabled: boolean;
  applicationApprovalRequired: boolean;
  emailApprovalRequired: boolean;
  browserAutomationEnabled: boolean;
  dailyApplicationLimit: number;
  hourlyApplicationLimit: number;
  minimumMatchScore: number;
  minimumSkillMatch: number;
  killSwitchActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobSearchProfile {
  id: string;
  userId: string;
  candidateId?: string | null;
  name: string;
  roles: string[];
  skills: string[];
  locations: string[];
  remoteTypes: string[];
  employmentTypes: string[];
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryCurrency?: string | null;
  industries: string[];
  sources: string[];
  minimumMatchScore: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AutomationRunType =
  | 'JOB_DISCOVERY'
  | 'JOB_PROCESSING'
  | 'MATCHING'
  | 'MATERIAL_GENERATION'
  | 'APPLICATION_PREPARATION'
  | 'APPLICATION_SUBMISSION';

export type AutomationRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export interface AutomationRun {
  id: string;
  userId: string;
  candidateId?: string | null;
  runType: AutomationRunType;
  status: AutomationRunStatus;
  startedAt: string;
  completedAt?: string | null;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errorSummary?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type AutomationEventType =
  | 'JOB_DISCOVERED'
  | 'JOB_DUPLICATE'
  | 'JOB_ANALYZED'
  | 'JOB_MATCHED'
  | 'JOB_SHORTLISTED'
  | 'JOB_EXCLUDED'
  | 'RESUME_GENERATED'
  | 'COVER_LETTER_GENERATED'
  | 'APPLICATION_PREPARED'
  | 'APPROVAL_REQUIRED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_FAILED'
  | 'KILL_SWITCH_TRIGGERED';

export interface AutomationEvent {
  id: string;
  automationRunId?: string | null;
  userId: string;
  candidateId?: string | null;
  jobId?: string | null;
  applicationId?: string | null;
  eventType: AutomationEventType;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'INFO';
  message: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type PreparationStatus =
  | 'PREPARING'
  | 'READY'
  | 'NEEDS_USER_INPUT'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUBMITTED'
  | 'FAILED';

export type AnswerSource = 'CANDIDATE_PROFILE' | 'RESUME' | 'USER_INPUT' | 'GENERATED';

export interface ApplicationQuestion {
  id: string;
  applicationPreparationId: string;
  question: string;
  questionType: 'text' | 'number' | 'boolean' | 'choice' | 'sensitive';
  candidateAnswer?: string | null;
  answerSource: AnswerSource;
  confidence: number;
  requiresUserInput: boolean;
  isSensitive: boolean;
  options?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationPreparation {
  id: string;
  userId: string;
  applicationId: string;
  jobId: string;
  source: string;
  status: PreparationStatus;
  resumeId?: string | null;
  tailoredResumeId?: string | null;
  coverLetterId?: string | null;
  preparedAnswers: Record<string, any>;
  missingAnswers: string[];
  warnings: string[];
  application?: Application;
  job?: Job;
  tailoredResume?: TailoredResume;
  coverLetter?: CoverLetter;
  questions?: ApplicationQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSubmission {
  id: string;
  applicationId: string;
  automationRunId?: string | null;
  userId: string;
  source: string;
  status: 'SUBMITTED' | 'REQUIRES_USER_ACTION' | 'BLOCKED' | 'FAILED' | 'UNKNOWN';
  sourceApplicationId?: string | null;
  confirmationUrl?: string | null;
  confirmationText?: string | null;
  error?: string | null;
  submittedAt: string;
}

export interface ApprovalItem {
  preparation: ApplicationPreparation;
  application: Application;
  job: Job;
  tailoredResume?: TailoredResume | null;
  coverLetter?: CoverLetter | null;
  questions: ApplicationQuestion[];
  requiresUserInput: boolean;
}

export interface AutomationSummary {
  settings: AutomationSettings;
  activeProfilesCount: number;
  todayStats: {
    jobsDiscovered: number;
    jobsAnalyzed: number;
    jobsMatched: number;
    jobsShortlisted: number;
    applicationsPrepared: number;
    applicationsSubmitted: number;
    pendingApprovals: number;
  };
  lastRun?: AutomationRun | null;
  recentEvents: AutomationEvent[];
  killSwitchActive: boolean;
}

