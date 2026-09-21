import { CandidateProfile, EmploymentType } from '@ai-job-hunter/shared';

export interface PreferenceMatchResult {
  preferenceScore: number; // 0 - 100
  salaryMatched: boolean | null;
  employmentTypeMatched: boolean | null;
  explanation: string;
}

export class PreferenceMatcher {
  public static matchPreferences(
    profile: CandidateProfile,
    jobEmploymentType: EmploymentType,
    jobSalaryMin: number | null,
    jobSalaryMax: number | null
  ): PreferenceMatchResult {
    const prefs = profile.preferences || {
      employmentTypes: [],
      minimumSalary: null,
    };

    let evaluatedPoints = 0;
    let earnedPoints = 0;

    // 1. Employment Type
    let employmentTypeMatched: boolean | null = null;
    if (Array.isArray(prefs.employmentTypes) && prefs.employmentTypes.length > 0) {
      evaluatedPoints += 50;
      if (jobEmploymentType === 'unknown') {
        // Neutral when job doesn't declare
        earnedPoints += 40;
        employmentTypeMatched = null;
      } else if (prefs.employmentTypes.includes(jobEmploymentType as any)) {
        earnedPoints += 50;
        employmentTypeMatched = true;
      } else {
        earnedPoints += 15;
        employmentTypeMatched = false;
      }
    }

    // 2. Salary Preference
    let salaryMatched: boolean | null = null;
    if (prefs.minimumSalary !== null && prefs.minimumSalary > 0) {
      evaluatedPoints += 50;
      if (jobSalaryMin === null && jobSalaryMax === null) {
        // Missing salary info is neutral, NOT 0
        earnedPoints += 45;
        salaryMatched = null;
      } else {
        const topOffer = jobSalaryMax ?? jobSalaryMin ?? 0;
        if (topOffer >= prefs.minimumSalary) {
          earnedPoints += 50;
          salaryMatched = true;
        } else {
          // Proportional below expectation
          const ratio = topOffer / prefs.minimumSalary;
          earnedPoints += Math.round(Math.max(10, ratio * 50));
          salaryMatched = false;
        }
      }
    }

    let finalScore = 100;
    if (evaluatedPoints > 0) {
      finalScore = Math.round((earnedPoints / evaluatedPoints) * 100);
    }

    const explanation =
      salaryMatched === false
        ? 'Salary offered is below candidate desired minimum.'
        : employmentTypeMatched === false
        ? 'Employment type differs from candidate preferred type.'
        : 'Candidate employment and compensation preferences satisfied or compatible.';

    return {
      preferenceScore: Math.min(100, Math.max(0, finalScore)),
      salaryMatched,
      employmentTypeMatched,
      explanation,
    };
  }
}
