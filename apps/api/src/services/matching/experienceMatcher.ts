import { CandidateProfile } from '@ai-job-hunter/shared';

export interface ExperienceMatchResult {
  experienceScore: number; // 0 - 100
  candidateYears: number;
  jobMinYears: number | null;
  jobMaxYears: number | null;
  explanation: string;
}

export class ExperienceMatcher {
  /**
   * Calculate total candidate experience in years from experience items.
   */
  public static calculateCandidateYears(profile: CandidateProfile): number {
    if (!Array.isArray(profile.experience) || profile.experience.length === 0) {
      return 0;
    }

    let totalMonths = 0;

    for (const item of profile.experience) {
      if (!item.startDate) {
        // If no explicit dates, grant 1 year per experience entry
        totalMonths += 12;
        continue;
      }

      const start = new Date(item.startDate);
      const end = item.current || !item.endDate ? new Date() : new Date(item.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        totalMonths += 12;
        continue;
      }

      const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      totalMonths += months;
    }

    return Math.round((totalMonths / 12) * 10) / 10;
  }

  public static matchExperience(
    profile: CandidateProfile,
    jobMinYears: number | null,
    jobMaxYears: number | null
  ): ExperienceMatchResult {
    const candidateYears = this.calculateCandidateYears(profile);

    // If job does not specify required experience, do NOT penalize candidate
    if (jobMinYears === null && jobMaxYears === null) {
      return {
        experienceScore: 100,
        candidateYears,
        jobMinYears: null,
        jobMaxYears: null,
        explanation: 'Job does not specify an experience requirement (neutral full match).',
      };
    }

    const min = jobMinYears ?? 0;
    const max = jobMaxYears ?? (min > 0 ? min + 4 : null);

    let score = 100;
    let explanation = '';

    if (max !== null && candidateYears >= min && candidateYears <= max) {
      score = 100;
      explanation = `Candidate experience (${candidateYears} yrs) fits perfectly within requested ${min}-${max} yrs.`;
    } else if (max === null && candidateYears >= min) {
      score = 100;
      explanation = `Candidate experience (${candidateYears} yrs) satisfies required ${min}+ yrs.`;
    } else if (candidateYears < min) {
      // Proportional score below minimum
      const ratio = min > 0 ? candidateYears / min : 0;
      score = Math.round(Math.max(10, ratio * 100));
      explanation = `Candidate experience (${candidateYears} yrs) is below requested minimum (${min} yrs).`;
    } else if (max !== null && candidateYears > max) {
      // Senior candidate applying to lower max experience: generous 95
      score = 95;
      explanation = `Candidate experience (${candidateYears} yrs) exceeds requested range (${min}-${max} yrs).`;
    }

    return {
      experienceScore: Math.min(100, Math.max(0, score)),
      candidateYears,
      jobMinYears,
      jobMaxYears,
      explanation,
    };
  }
}
