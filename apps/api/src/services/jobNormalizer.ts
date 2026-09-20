import { RawJob, RemoteType, EmploymentType } from '@ai-job-hunter/shared';

export interface NormalizedJobData {
  sourceJobId: string;
  title: string;
  company: string;
  companyUrl: string | null;
  jobUrl: string | null;
  location: string | null;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  postedAt: string;
  expiresAt: string | null;
  skills: string[];
  rawData: Record<string, any>;
}

export class JobNormalizer {
  /**
   * Normalize raw employment type into standard enum.
   */
  public static normalizeEmploymentType(raw?: string): EmploymentType {
    if (!raw) return 'unknown';
    const clean = raw.toLowerCase().trim().replace(/[-_]/g, ' ');

    if (clean.includes('full time') || clean.includes('permanent') || clean.includes('regular')) {
      return 'full_time';
    }
    if (clean.includes('part time') || clean.includes('fractional')) {
      return 'part_time';
    }
    if (clean.includes('contract') || clean.includes('freelance') || clean.includes('temporary') || clean.includes('temp')) {
      return 'contract';
    }
    if (clean.includes('intern') || clean.includes('apprenticeship') || clean.includes('student')) {
      return 'internship';
    }

    return 'unknown';
  }

  /**
   * Normalize remote work arrangements.
   */
  public static normalizeRemoteType(raw?: string, location?: string): RemoteType {
    const combined = `${raw || ''} ${location || ''}`.toLowerCase();

    if (combined.includes('100% remote') || combined.includes('fully remote') || combined.includes('work from anywhere') || combined.includes('remote')) {
      return 'remote';
    }
    if (combined.includes('hybrid') || combined.includes('flexible')) {
      return 'hybrid';
    }
    if (combined.includes('onsite') || combined.includes('on-site') || combined.includes('in office') || combined.includes('office')) {
      return 'onsite';
    }

    return 'unknown';
  }

  /**
   * Normalize salary values without hallucination.
   */
  public static normalizeSalary(rawJob: RawJob): {
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string | null;
  } {
    let min = rawJob.salaryMin ?? null;
    let max = rawJob.salaryMax ?? null;
    let curr = rawJob.salaryCurrency?.toUpperCase().trim() || null;

    if (min !== null && isNaN(Number(min))) min = null;
    if (max !== null && isNaN(Number(max))) max = null;

    if (min !== null && max !== null && min > max) {
      const temp = min;
      min = max;
      max = temp;
    }

    return {
      salaryMin: min,
      salaryMax: max,
      salaryCurrency: (min !== null || max !== null) ? (curr || 'USD') : null,
    };
  }

  /**
   * Normalize skills array.
   */
  public static normalizeSkills(rawSkills?: string[]): string[] {
    if (!Array.isArray(rawSkills)) return [];
    const set = new Set<string>();
    for (const skill of rawSkills) {
      if (typeof skill === 'string' && skill.trim()) {
        set.add(skill.trim());
      }
    }
    return Array.from(set);
  }

  /**
   * Produce fully canonical normalized job representation.
   */
  public static normalize(raw: RawJob): NormalizedJobData {
    const salary = this.normalizeSalary(raw);

    let parsedPostedAt: string;
    if (raw.postedAt instanceof Date) {
      parsedPostedAt = raw.postedAt.toISOString();
    } else if (typeof raw.postedAt === 'string' && !isNaN(Date.parse(raw.postedAt))) {
      parsedPostedAt = new Date(raw.postedAt).toISOString();
    } else {
      parsedPostedAt = new Date().toISOString();
    }

    let parsedExpiresAt: string | null = null;
    if (raw.expiresAt instanceof Date) {
      parsedExpiresAt = raw.expiresAt.toISOString();
    } else if (typeof raw.expiresAt === 'string' && !isNaN(Date.parse(raw.expiresAt))) {
      parsedExpiresAt = new Date(raw.expiresAt).toISOString();
    }

    return {
      sourceJobId: String(raw.sourceJobId).trim(),
      title: raw.title.trim(),
      company: raw.company.trim(),
      companyUrl: raw.companyUrl?.trim() || null,
      jobUrl: raw.jobUrl?.trim() || null,
      location: raw.location?.trim() || null,
      remoteType: this.normalizeRemoteType(raw.remoteType, raw.location),
      employmentType: this.normalizeEmploymentType(raw.employmentType),
      description: raw.description.trim(),
      salaryMin: salary.salaryMin,
      salaryMax: salary.salaryMax,
      salaryCurrency: salary.salaryCurrency,
      experienceMin: raw.experienceMin ?? null,
      experienceMax: raw.experienceMax ?? null,
      postedAt: parsedPostedAt,
      expiresAt: parsedExpiresAt,
      skills: this.normalizeSkills(raw.skills),
      rawData: raw.rawData || {},
    };
  }
}
