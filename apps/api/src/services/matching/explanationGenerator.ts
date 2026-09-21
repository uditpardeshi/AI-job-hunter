import { MatchComponents } from '@ai-job-hunter/shared';

export interface ExplanationInput {
  jobTitle: string;
  company: string;
  components: MatchComponents;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  roleExplanation: string;
  experienceExplanation: string;
  locationExplanation: string;
  preferenceExplanation: string;
  penaltyDeducted: number;
}

export interface GeneratedExplanation {
  explanation: string;
  strengths: string[];
  concerns: string[];
}

export class ExplanationGenerator {
  public static generate(input: ExplanationInput): GeneratedExplanation {
    const strengths: string[] = [];
    const concerns: string[] = [];

    // 1. Skill analysis
    if (input.matchedSkills.length > 0) {
      const topSkills = input.matchedSkills.slice(0, 5).join(', ');
      strengths.push(`Matches ${input.matchedSkills.length} key technology skills: ${topSkills}.`);
    }

    if (input.missingRequiredSkills.length > 0) {
      concerns.push(
        `Missing required mandatory skill(s): ${input.missingRequiredSkills.join(', ')}.`
      );
    }

    if (input.missingPreferredSkills.length > 0) {
      concerns.push(
        `Missing preferred/bonus skill(s): ${input.missingPreferredSkills.slice(0, 3).join(', ')}.`
      );
    }

    // 2. Role analysis
    if (input.components.roleMatch >= 80) {
      strengths.push(`Strong role alignment: ${input.roleExplanation}`);
    } else if (input.components.roleMatch < 60) {
      concerns.push(`Role disparity: ${input.roleExplanation}`);
    }

    // 3. Experience analysis
    if (input.components.experienceMatch >= 90) {
      strengths.push(input.experienceExplanation);
    } else if (input.components.experienceMatch < 70) {
      concerns.push(input.experienceExplanation);
    }

    // 4. Location analysis
    if (input.components.locationMatch >= 90) {
      strengths.push(input.locationExplanation);
    } else if (input.components.locationMatch < 60) {
      concerns.push(input.locationExplanation);
    }

    // 5. Build grounded synthesis paragraph
    const sentences: string[] = [];

    if (input.matchedSkills.length > 0) {
      sentences.push(
        `The candidate profile demonstrates verified alignment with ${input.matchedSkills.slice(0, 4).join(', ')}.`
      );
    }

    if (input.components.experienceMatch >= 80) {
      sentences.push(input.experienceExplanation);
    }

    if (input.missingRequiredSkills.length > 0) {
      sentences.push(
        `${input.missingRequiredSkills.join(' and ')} ${
          input.missingRequiredSkills.length === 1 ? 'is' : 'are'
        } listed as required for this position but not found in the verified profile.`
      );
    } else if (input.missingPreferredSkills.length > 0) {
      sentences.push(
        `All mandatory skills are satisfied; ${input.missingPreferredSkills.slice(0, 2).join(', ')} would be an advantageous plus.`
      );
    }

    if (input.components.locationMatch >= 90) {
      sentences.push(input.locationExplanation);
    }

    const explanation =
      sentences.join(' ') ||
      `Candidate profile evaluated against requirements for ${input.jobTitle} at ${input.company}.`;

    return {
      explanation,
      strengths,
      concerns,
    };
  }
}
