import {
  IJobSourceConnector,
  IApplicationConnector,
  ApplicationContext,
  ApplicationPreparationResult,
  ApplicationSubmissionResult,
} from '../types';
import { RawJob, JobSourceCapabilities, SourceCapabilities, SourceApplicationMode } from '@ai-job-hunter/shared';

export class MockJobSource implements IJobSourceConnector, IApplicationConnector {
  public readonly id = 'mock';
  public readonly name = 'Mock Job Provider';
  public readonly capabilities: JobSourceCapabilities = {
    search: true,
    jobDetails: true,
    api: true,
    publicFeed: false,
    automatedCollection: true,
  };

  public async fetchJobs(_params?: Record<string, any>): Promise<RawJob[]> {
    return [
      {
        sourceJobId: 'mock-job-001',
        title: 'Senior Backend Engineer',
        company: 'TechCorp Global',
        companyUrl: 'https://techcorp.example.com',
        jobUrl: 'https://techcorp.example.com/careers/backend-001',
        location: 'Bengaluru, India',
        remoteType: 'hybrid',
        employmentType: 'Full-Time',
        description: 'We are seeking an experienced Backend Engineer to design high-throughput microservices using Node.js, TypeScript, PostgreSQL, and Redis. You will lead architectural reviews and optimize database query performance.',
        salaryMin: 2500000,
        salaryMax: 3500000,
        salaryCurrency: 'INR',
        experienceMin: 5,
        experienceMax: 8,
        postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker'],
        rawData: {
          department: 'Engineering',
          team: 'Core Platform',
          requisitionId: 'REQ-9821',
        },
      },
      {
        sourceJobId: 'mock-job-002',
        title: 'Full Stack Developer',
        company: 'Starlight Media',
        companyUrl: 'https://starlight.example.com',
        jobUrl: 'https://starlight.example.com/jobs/fs-002',
        location: 'Remote',
        remoteType: '100% Remote',
        employmentType: 'full_time',
        description: 'Join our product team building next-generation digital experiences. Stack includes Next.js, React, Tailwind CSS, Python, and FastAPI with automated CI/CD pipelines on AWS.',
        salaryMin: 120000,
        salaryMax: 155000,
        salaryCurrency: 'USD',
        experienceMin: 3,
        experienceMax: 6,
        postedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
        skills: ['React', 'Next.js', 'TypeScript', 'Python', 'FastAPI', 'AWS'],
        rawData: {
          openings: 2,
          benefits: ['Health', '401k', 'Remote Stipend'],
        },
      },
      {
        sourceJobId: 'mock-job-003',
        title: 'Lead AI Systems Architect',
        company: 'Nexus Intelligence',
        companyUrl: 'https://nexus-ai.example.com',
        jobUrl: 'https://nexus-ai.example.com/careers/lead-ai-architect',
        location: 'San Francisco, CA',
        remoteType: 'onsite',
        employmentType: 'Permanent',
        description: 'Design and deploy large-scale LLM inference pipelines, model evaluation frameworks, and vector search systems. Experience with Docker, Kubernetes, and distributed Python microservices required.',
        salaryMin: 210000,
        salaryMax: 275000,
        salaryCurrency: 'USD',
        experienceMin: 7,
        experienceMax: 12,
        postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        skills: ['Python', 'FastAPI', 'PyTorch', 'Docker', 'Kubernetes', 'Ollama'],
        rawData: {
          equity: '0.1% - 0.25%',
          visa_sponsorship: true,
        },
      },
      {
        sourceJobId: 'mock-job-004',
        title: 'Cloud Infrastructure & DevOps Engineer',
        company: 'CloudScale UK',
        companyUrl: 'https://cloudscale.example.co.uk',
        jobUrl: 'https://cloudscale.example.co.uk/apply/devops-uk',
        location: 'London, UK',
        remoteType: 'hybrid',
        employmentType: 'Contractor',
        description: 'Build robust Terraform infrastructure as code, manage multi-region Kubernetes clusters, and automate observability stacks with Prometheus and Grafana.',
        salaryMin: 85000,
        salaryMax: 105000,
        salaryCurrency: 'GBP',
        experienceMin: 4,
        experienceMax: 8,
        postedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        skills: ['AWS', 'Terraform', 'Kubernetes', 'Docker', 'Linux', 'Prometheus'],
        rawData: {
          contract_duration_months: 12,
        },
      },
      {
        sourceJobId: 'mock-job-005',
        title: 'Frontend React Developer',
        company: 'DesignFlow Studio',
        companyUrl: 'https://designflow.example.com',
        jobUrl: 'https://designflow.example.com/careers/frontend-react',
        location: 'Berlin, Germany',
        remoteType: 'Remote',
        employmentType: 'Part-Time',
        description: 'Craft beautiful, accessible web applications in Next.js and Tailwind CSS with fluid animations and responsive mobile-first layouts.',
        salaryMin: 45000,
        salaryMax: 60000,
        salaryCurrency: 'EUR',
        experienceMin: 2,
        experienceMax: 5,
        postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        skills: ['React', 'Next.js', 'Tailwind CSS', 'TypeScript', 'Figma'],
        rawData: {
          hours_per_week: 20,
        },
      },
      {
        sourceJobId: 'mock-job-006',
        title: 'Junior Backend Developer',
        company: 'InnovateX Labs',
        companyUrl: 'https://innovatex.example.com',
        jobUrl: 'https://innovatex.example.com/jobs/junior-backend',
        location: 'Austin, TX',
        remoteType: 'onsite',
        employmentType: 'Internship',
        description: 'Great opportunity for aspiring backend developers to work with Go, PostgreSQL, and Redis in an agile startup environment. Mentorship provided.',
        salaryMin: 60000,
        salaryMax: 72000,
        salaryCurrency: 'USD',
        experienceMin: 0,
        experienceMax: 2,
        postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        skills: ['Go', 'PostgreSQL', 'Docker', 'Git'],
        rawData: {
          internship_period: '6 months',
        },
      },
      // Intentional duplicate of mock-job-001 with slightly different formatting to test deduplication
      {
        sourceJobId: 'mock-job-001',
        title: 'Senior Backend Engineer',
        company: 'TechCorp Global',
        companyUrl: 'https://techcorp.example.com',
        jobUrl: 'https://techcorp.example.com/careers/backend-001',
        location: 'Bengaluru, India',
        remoteType: 'hybrid',
        employmentType: 'full_time',
        description: 'Updated description: We are seeking an experienced Backend Engineer to design high-throughput microservices using Node.js, TypeScript, PostgreSQL, and Redis.',
        salaryMin: 2500000,
        salaryMax: 3500000,
        salaryCurrency: 'INR',
        experienceMin: 5,
        experienceMax: 8,
        postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker'],
        rawData: {
          department: 'Engineering',
          version: 'updated',
        },
      },
    ];
  }

  public getSourceCapabilities(): SourceCapabilities {
    return {
      jobSearch: true,
      jobDetails: true,
      apiAvailable: true,
      publicFeedAvailable: false,
      applicationUrlAvailable: true,
      automatedApplicationAllowed: true,
      browserAutomationAllowed: true,
      requiresAuthentication: false,
      requiresHumanApproval: false,
      applicationMode: 'AUTOMATED',
    };
  }

  // Application Connector implementation for mock/dev testing
  public canApply(): boolean {
    return true;
  }

  public getApplicationMode(): SourceApplicationMode {
    return 'AUTOMATED';
  }

  public async prepareApplication(ctx: ApplicationContext): Promise<ApplicationPreparationResult> {
    return {
      status: 'READY',
      preparedAnswers: {
        fullName: 'Alex Rivera',
        email: 'alex.rivera@example.com',
        phone: '+1 (555) 234-5678',
        yearsOfExperience: 5,
        workAuthorization: 'Authorized to work in US/India',
      },
      missingAnswers: [],
      warnings: [],
    };
  }

  public async submitApplication(ctx: ApplicationContext): Promise<ApplicationSubmissionResult> {
    const confirmationId = `MOCK-APP-${Date.now().toString(36).toUpperCase()}`;
    return {
      status: 'SUBMITTED',
      sourceApplicationId: confirmationId,
      confirmationUrl: `https://mock.example.com/applications/${confirmationId}`,
      confirmationText: `Application successfully received. Confirmation #${confirmationId}`,
    };
  }
}
