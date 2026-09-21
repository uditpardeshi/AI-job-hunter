import { CandidateProfile, TailoredResumeData, ValidationFlag } from '@ai-job-hunter/shared';
import { SkillNormalizer } from '../matching/skillNormalizer';

export class AntiFabricationValidator {
  /**
   * Validate tailored resume against verified candidate profile.
   * Flags unsupported skills, unverified employers, or fabricated credentials.
   */
  public static validate(
    resumeData: TailoredResumeData,
    verifiedProfile: CandidateProfile
  ): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    // 1. Build verified candidate skills set
    const verifiedExtracted = SkillNormalizer.extractCandidateSkills(verifiedProfile);
    const verifiedSkillsSet = new Set(
      verifiedExtracted.map((s) => s.skill.toLowerCase())
    );

    // Also include raw skills from profile just in case
    (verifiedProfile.skills || []).forEach((s) => {
      verifiedSkillsSet.add(s.toLowerCase());
      const norm = SkillNormalizer.normalize(s).normalized.toLowerCase();
      if (norm) verifiedSkillsSet.add(norm);
    });

    // Check tailored resume skills
    const resumeSkills = resumeData.skills || [];
    for (const skill of resumeSkills) {
      if (!skill || typeof skill !== 'string') continue;
      const clean = skill.trim().toLowerCase();
      const norm = SkillNormalizer.normalize(skill).normalized.toLowerCase();

      if (!verifiedSkillsSet.has(clean) && !verifiedSkillsSet.has(norm)) {
        flags.push({
          type: 'unsupported_skill',
          item: skill,
          message: `Skill "${skill}" is not present in your verified candidate profile.`,
          resolved: false,
        });
      }
    }

    // 2. Validate employers
    const verifiedCompanies = new Set(
      (verifiedProfile.experience || []).map((e) => e.company.toLowerCase().trim())
    );

    const resumeExp = resumeData.experience || [];
    for (const exp of resumeExp) {
      if (!exp.company) continue;
      const compClean = exp.company.toLowerCase().trim();

      // Check if candidate actually worked at this company
      const foundCompany = Array.from(verifiedCompanies).some(
        (vc) => compClean.includes(vc) || vc.includes(compClean)
      );

      if (!foundCompany && verifiedCompanies.size > 0) {
        flags.push({
          type: 'unsupported_employer',
          item: exp.company,
          message: `Employer "${exp.company}" does not match any company in your verified experience.`,
          resolved: false,
        });
      }
    }

    // 3. Validate certifications
    const verifiedCerts = new Set(
      (verifiedProfile.certifications || []).map((c) => c.name.toLowerCase().trim())
    );

    const resumeCerts = resumeData.certifications || [];
    for (const cert of resumeCerts) {
      if (!cert.name) continue;
      const certClean = cert.name.toLowerCase().trim();
      const foundCert = Array.from(verifiedCerts).some(
        (vc) => certClean.includes(vc) || vc.includes(certClean)
      );

      if (!foundCert && verifiedCerts.size > 0) {
        flags.push({
          type: 'unsupported_credential',
          item: cert.name,
          message: `Certification "${cert.name}" was not found in your verified credentials.`,
          resolved: false,
        });
      }
    }

    return flags;
  }
}
