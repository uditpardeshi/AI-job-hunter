import { TailoredResumeData, AtsAnalysisResult } from '@ai-job-hunter/shared';
import { SkillNormalizer } from '../matching/skillNormalizer';

export class AtsAnalyzer {
  public static analyze(
    resumeData: TailoredResumeData,
    jobRequiredSkills: string[],
    jobPreferredSkills: string[],
    jobDescription: string
  ): AtsAnalysisResult {
    const resumeSkills = (resumeData.skills || []).map((s) =>
      SkillNormalizer.normalize(s).normalized.toLowerCase()
    );

    // Also collect skills mentioned across experience bullets and summary
    const resumeText = [
      resumeData.summary || '',
      ...(resumeData.experience || []).flatMap((e) => e.bullets || []),
      ...(resumeData.projects || []).map((p) => p.description || ''),
    ].join(' ').toLowerCase();

    const normalizedRequired = jobRequiredSkills.map(
      (s) => SkillNormalizer.normalize(s).normalized
    );
    const normalizedPreferred = jobPreferredSkills.map(
      (s) => SkillNormalizer.normalize(s).normalized
    );

    const allJobSkills = Array.from(new Set([...normalizedRequired, ...normalizedPreferred]));

    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    for (const skill of allJobSkills) {
      const lower = skill.toLowerCase();
      if (resumeSkills.includes(lower) || resumeText.includes(lower)) {
        matchedKeywords.push(skill);
      } else {
        missingKeywords.push(skill);
      }
    }

    // Formatting Checks
    const formattingIssues: string[] = [];
    const recommendations: string[] = [];

    // Header check
    if (!resumeData.header?.email) {
      formattingIssues.push('Missing email address in contact header.');
    }
    if (!resumeData.header?.phone) {
      formattingIssues.push('Missing phone number in contact header.');
    }

    // Summary check
    if (!resumeData.summary || resumeData.summary.trim().length < 50) {
      recommendations.push('Include a 2-3 sentence professional summary tailored to the target role.');
    }

    // Experience check
    if (!resumeData.experience || resumeData.experience.length === 0) {
      formattingIssues.push('No work experience entries found.');
    } else {
      let hasLongBullets = false;
      let hasShortBullets = false;
      for (const exp of resumeData.experience) {
        for (const b of exp.bullets || []) {
          if (b.length > 250) hasLongBullets = true;
          if (b.length < 15) hasShortBullets = true;
        }
      }
      if (hasLongBullets) {
        recommendations.push('Shorten verbose bullet points exceeding 250 characters for clean ATS parsing.');
      }
      if (hasShortBullets) {
        recommendations.push('Elaborate on short bullet points with concrete technical contributions.');
      }
    }

    // Skills placement check
    if (matchedKeywords.length > 0) {
      recommendations.push(
        `Highlight top matched technologies (${matchedKeywords.slice(0, 3).join(', ')}) in your top skills section.`
      );
    }

    // Alignment Score Calculation
    let score = 75; // Baseline
    if (allJobSkills.length > 0) {
      const matchRatio = matchedKeywords.length / allJobSkills.length;
      score = Math.round(matchRatio * 70 + (formattingIssues.length === 0 ? 30 : 15));
    } else {
      score = formattingIssues.length === 0 ? 90 : 70;
    }

    const alignmentScore = Math.min(100, Math.max(20, score));

    return {
      alignmentScore,
      matchedKeywords,
      missingKeywords,
      formattingIssues,
      recommendations,
    };
  }
}
