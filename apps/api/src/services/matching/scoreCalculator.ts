import { MatchComponents } from '@ai-job-hunter/shared';

export interface ScoreWeights {
  skills: number;
  role: number;
  experience: number;
  semantic: number;
  location: number;
  preference: number;
  requiredSkillPenalty: number;
}

export const SCORING_VERSION = 'v1.0-weighted-penalty';

export class ScoreCalculator {
  public static getWeights(): ScoreWeights {
    return {
      skills: parseFloat(process.env.MATCH_WEIGHT_SKILLS || '0.30'),
      role: parseFloat(process.env.MATCH_WEIGHT_ROLE || '0.20'),
      experience: parseFloat(process.env.MATCH_WEIGHT_EXPERIENCE || '0.15'),
      semantic: parseFloat(process.env.MATCH_WEIGHT_SEMANTIC || '0.15'),
      location: parseFloat(process.env.MATCH_WEIGHT_LOCATION || '0.10'),
      preference: parseFloat(process.env.MATCH_WEIGHT_PREFERENCE || '0.10'),
      requiredSkillPenalty: parseFloat(process.env.REQUIRED_SKILL_PENALTY || '0.10'),
    };
  }

  /**
   * Calculate final match score from component scores and missing required skills.
   */
  public static calculateScore(
    components: MatchComponents,
    missingRequiredSkillsCount: number
  ): { matchScore: number; baseScore: number; penaltyDeducted: number; weights: ScoreWeights } {
    const weights = this.getWeights();

    // 1. Base weighted sum
    const baseScore =
      components.skillMatch * weights.skills +
      components.roleMatch * weights.role +
      components.experienceMatch * weights.experience +
      components.semanticMatch * weights.semantic +
      components.locationMatch * weights.location +
      components.preferenceMatch * weights.preference;

    // 2. Penalty for missing required skills
    // Each missing required skill deducts e.g. 10 points (0.10 * 100), capped at 40 points total deduction
    const penaltyPerSkill = weights.requiredSkillPenalty * 100;
    const maxPenalty = 40;
    const penaltyDeducted = Math.min(maxPenalty, missingRequiredSkillsCount * penaltyPerSkill);

    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore - penaltyDeducted)));

    return {
      matchScore: finalScore,
      baseScore: Math.round(baseScore * 10) / 10,
      penaltyDeducted,
      weights,
    };
  }
}
