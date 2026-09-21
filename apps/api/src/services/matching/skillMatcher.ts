import { SkillNormalizer, CandidateExtractedSkill } from './skillNormalizer';

export interface SkillMatchResult {
  skillScore: number; // 0 - 100
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  matchedRequiredSkills: string[];
  matchedPreferredSkills: string[];
}

export class SkillMatcher {
  public static matchSkills(
    candidateSkills: CandidateExtractedSkill[],
    jobRequiredSkills: string[],
    jobPreferredSkills: string[]
  ): SkillMatchResult {
    // Set of candidate normalized skill names (case-insensitive key comparison)
    const candidateSkillMap = new Map<string, string>();
    candidateSkills.forEach((item) => {
      candidateSkillMap.set(item.skill.toLowerCase(), item.skill);
    });

    // Normalize job required skills
    const normalizedRequired: string[] = [];
    jobRequiredSkills.forEach((s) => {
      const norm = SkillNormalizer.normalize(s).normalized;
      if (norm && !normalizedRequired.includes(norm)) {
        normalizedRequired.push(norm);
      }
    });

    // Normalize job preferred skills
    const normalizedPreferred: string[] = [];
    jobPreferredSkills.forEach((s) => {
      const norm = SkillNormalizer.normalize(s).normalized;
      if (norm && !normalizedPreferred.includes(norm) && !normalizedRequired.includes(norm)) {
        normalizedPreferred.push(norm);
      }
    });

    const matchedRequiredSkills: string[] = [];
    const missingRequiredSkills: string[] = [];

    for (const req of normalizedRequired) {
      if (candidateSkillMap.has(req.toLowerCase())) {
        matchedRequiredSkills.push(req);
      } else {
        missingRequiredSkills.push(req);
      }
    }

    const matchedPreferredSkills: string[] = [];
    const missingPreferredSkills: string[] = [];

    for (const pref of normalizedPreferred) {
      if (candidateSkillMap.has(pref.toLowerCase())) {
        matchedPreferredSkills.push(pref);
      } else {
        missingPreferredSkills.push(pref);
      }
    }

    const matchedSkills = [...matchedRequiredSkills, ...matchedPreferredSkills];

    // Compute raw skillScore (0 - 100)
    let score = 100;
    const hasRequired = normalizedRequired.length > 0;
    const hasPreferred = normalizedPreferred.length > 0;

    if (hasRequired && hasPreferred) {
      const reqRatio = matchedRequiredSkills.length / normalizedRequired.length;
      const prefRatio = matchedPreferredSkills.length / normalizedPreferred.length;
      // 75% required, 25% preferred
      score = Math.round((reqRatio * 0.75 + prefRatio * 0.25) * 100);
    } else if (hasRequired) {
      const reqRatio = matchedRequiredSkills.length / normalizedRequired.length;
      score = Math.round(reqRatio * 100);
    } else if (hasPreferred) {
      const prefRatio = matchedPreferredSkills.length / normalizedPreferred.length;
      score = Math.round(prefRatio * 100);
    } else {
      // If job posting specifies no skills, default to neutral 100
      score = 100;
    }

    return {
      skillScore: Math.min(100, Math.max(0, score)),
      matchedSkills,
      missingRequiredSkills,
      missingPreferredSkills,
      matchedRequiredSkills,
      matchedPreferredSkills,
    };
  }
}
