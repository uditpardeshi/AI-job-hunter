import { CandidateProfile } from '@ai-job-hunter/shared';

export interface RoleMatchResult {
  roleScore: number; // 0 - 100
  matchedRoleName: string;
  explanation: string;
}

type RoleDomain = 'backend' | 'frontend' | 'fullstack' | 'devops' | 'mobile' | 'data' | 'qa' | 'general';

const DOMAIN_KEYWORDS: Record<RoleDomain, string[]> = {
  backend: ['backend', 'back-end', 'server', 'api', 'distributed systems', 'microservices', 'systems engineer'],
  frontend: ['frontend', 'front-end', 'client', 'ui', 'react', 'web developer', 'angular', 'vue'],
  fullstack: ['fullstack', 'full-stack', 'full stack', 'software engineer', 'software developer', 'application developer'],
  devops: ['devops', 'sre', 'site reliability', 'infrastructure', 'platform engineer', 'cloud engineer', 'cloud architect'],
  mobile: ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift'],
  data: ['data engineer', 'data scientist', 'data analyst', 'machine learning', 'ml engineer', 'ai engineer', 'nlp'],
  qa: ['qa', 'quality assurance', 'test engineer', 'automation engineer', 'sdet'],
  general: ['engineer', 'developer', 'programmer'],
};

export class RoleMatcher {
  private static detectDomain(text: string): RoleDomain {
    const clean = text.toLowerCase();
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (domain === 'general') continue;
      for (const kw of keywords) {
        if (clean.includes(kw)) {
          return domain as RoleDomain;
        }
      }
    }
    return 'general';
  }

  public static matchRole(profile: CandidateProfile, jobRole: string, jobTitle: string): RoleMatchResult {
    const jobTarget = `${jobRole} ${jobTitle}`.toLowerCase();
    const jobDomain = this.detectDomain(jobTarget);

    // Candidate candidate roles from preferences and past titles
    const candidateRoles: string[] = [];
    if (profile.preferences && Array.isArray(profile.preferences.preferredRoles)) {
      candidateRoles.push(...profile.preferences.preferredRoles);
    }
    if (Array.isArray(profile.experience)) {
      profile.experience.forEach((exp) => {
        if (exp.title) candidateRoles.push(exp.title);
      });
    }

    if (candidateRoles.length === 0) {
      // Neutral baseline when profile lacks titles and preferences
      return {
        roleScore: 75,
        matchedRoleName: jobRole || jobTitle,
        explanation: 'Role compatibility evaluated as neutral baseline (no specific role preference indicated).',
      };
    }

    let highestScore = 0;
    let bestMatched = candidateRoles[0];

    for (const candRole of candidateRoles) {
      const candClean = candRole.toLowerCase();
      const candDomain = this.detectDomain(candClean);

      // Exact phrase match
      if (jobTarget.includes(candClean) || candClean.includes(jobRole.toLowerCase())) {
        if (100 > highestScore) {
          highestScore = 100;
          bestMatched = candRole;
        }
        continue;
      }

      // Exact domain match (e.g. Backend vs Backend)
      if (candDomain === jobDomain && jobDomain !== 'general') {
        const score = 90;
        if (score > highestScore) {
          highestScore = score;
          bestMatched = candRole;
        }
        continue;
      }

      // Compatible adjacent domains
      const isAdjacent =
        (candDomain === 'fullstack' && (jobDomain === 'backend' || jobDomain === 'frontend')) ||
        ((candDomain === 'backend' || candDomain === 'frontend') && jobDomain === 'fullstack') ||
        (candDomain === 'backend' && jobDomain === 'devops') ||
        (candDomain === 'devops' && jobDomain === 'backend');

      if (isAdjacent) {
        const score = 75;
        if (score > highestScore) {
          highestScore = score;
          bestMatched = candRole;
        }
        continue;
      }

      // Cross-domain tech role
      if (candDomain !== 'general' && jobDomain !== 'general') {
        const score = 45;
        if (score > highestScore) {
          highestScore = score;
          bestMatched = candRole;
        }
        continue;
      }

      // General fallback
      const score = 55;
      if (score > highestScore) {
        highestScore = score;
        bestMatched = candRole;
      }
    }

    return {
      roleScore: highestScore,
      matchedRoleName: bestMatched,
      explanation:
        highestScore >= 90
          ? `Strong alignment between candidate background "${bestMatched}" and job role "${jobRole || jobTitle}".`
          : highestScore >= 70
          ? `Relevant adjacent alignment between "${bestMatched}" and job role "${jobRole || jobTitle}".`
          : `Moderate cross-domain alignment between "${bestMatched}" and job role "${jobRole || jobTitle}".`,
    };
  }
}
