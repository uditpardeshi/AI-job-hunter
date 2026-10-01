import crypto from 'crypto';
import { pool } from '../../db';
import {
  CandidateProfile,
  JobAnalysis,
  JobMatchResult,
  MatchComponents,
  Job,
} from '@ai-job-hunter/shared';
import { logger } from '../../utils/logger';
import { analyzeJobWithAi, generateEmbeddingsWithAi } from '../aiClient';
import { SkillNormalizer } from './skillNormalizer';
import { SkillMatcher } from './skillMatcher';
import { RoleMatcher } from './roleMatcher';
import { ExperienceMatcher } from './experienceMatcher';
import { LocationMatcher } from './locationMatcher';
import { PreferenceMatcher } from './preferenceMatcher';
import { SemanticMatcher } from './semanticMatcher';
import { ScoreCalculator, SCORING_VERSION } from './scoreCalculator';
import { ExplanationGenerator } from './explanationGenerator';

export const EMBEDDING_MODEL_VERSION = 'sentence-transformers/all-MiniLM-L6-v2';

export class MatchingService {
  private static hashContent(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Analyze job description using AI service and cache in job_analyses.
   */
  public static async analyzeJob(jobId: string): Promise<JobAnalysis> {
    const existing = await this.getJobAnalysis(jobId);
    if (existing) {
      return existing;
    }

    // Fetch job details
    const jobRes = await pool.query(
      `SELECT id, title, description, remote_type, skills FROM jobs WHERE id = $1`,
      [jobId]
    );

    if (jobRes.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const job = jobRes.rows[0];
    const aiResult = await analyzeJobWithAi(job.title, job.description);

    const insertRes = await pool.query(
      `
      INSERT INTO job_analyses (
        job_id, role, seniority, required_skills, preferred_skills,
        responsibilities, education_requirements, experience_min,
        experience_max, remote_type, model_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (job_id) DO UPDATE SET
        role = EXCLUDED.role,
        seniority = EXCLUDED.seniority,
        required_skills = EXCLUDED.required_skills,
        preferred_skills = EXCLUDED.preferred_skills,
        responsibilities = EXCLUDED.responsibilities,
        education_requirements = EXCLUDED.education_requirements,
        experience_min = EXCLUDED.experience_min,
        experience_max = EXCLUDED.experience_max,
        remote_type = EXCLUDED.remote_type,
        model_used = EXCLUDED.model_used,
        updated_at = NOW()
      RETURNING *;
      `,
      [
        jobId,
        aiResult.role,
        aiResult.seniority,
        JSON.stringify(aiResult.requiredSkills || []),
        JSON.stringify(aiResult.preferredSkills || []),
        JSON.stringify(aiResult.responsibilities || []),
        JSON.stringify(aiResult.educationRequirements || []),
        aiResult.experienceMin,
        aiResult.experienceMax,
        aiResult.remoteType || job.remote_type,
        aiResult.modelUsed,
      ]
    );

    const row = insertRes.rows[0];
    return {
      id: row.id,
      jobId: row.job_id,
      role: row.role,
      seniority: row.seniority,
      requiredSkills: row.required_skills || [],
      preferredSkills: row.preferred_skills || [],
      responsibilities: row.responsibilities || [],
      educationRequirements: row.education_requirements || [],
      experienceMin: row.experience_min,
      experienceMax: row.experience_max,
      remoteType: row.remote_type,
      modelUsed: row.model_used,
      analyzedAt: row.created_at,
    };
  }

  /**
   * Get cached job analysis.
   */
  public static async getJobAnalysis(jobId: string): Promise<JobAnalysis | null> {
    const res = await pool.query(
      `SELECT * FROM job_analyses WHERE job_id = $1`,
      [jobId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      jobId: row.job_id,
      role: row.role,
      seniority: row.seniority,
      requiredSkills: row.required_skills || [],
      preferredSkills: row.preferred_skills || [],
      responsibilities: row.responsibilities || [],
      educationRequirements: row.education_requirements || [],
      experienceMin: row.experience_min,
      experienceMax: row.experience_max,
      remoteType: row.remote_type,
      modelUsed: row.model_used,
      analyzedAt: row.created_at,
    };
  }

  /**
   * Get or generate job embedding with caching.
   */
  public static async ensureJobEmbedding(job: {
    id: string;
    title: string;
    description: string;
    skills?: string[];
  }, analysis?: JobAnalysis | null): Promise<number[]> {
    const skillsList = [
      ...(analysis?.requiredSkills || []),
      ...(analysis?.preferredSkills || []),
      ...(job.skills || []),
    ].join(', ');

    const textToEmbed = `${job.title}. ${job.description.slice(0, 1500)}. Skills: ${skillsList}`;
    const contentHash = this.hashContent(textToEmbed);

    // Check database cache
    const cached = await pool.query(
      `SELECT embedding::text FROM job_embeddings WHERE job_id = $1 AND model_name = $2 AND content_hash = $3`,
      [job.id, EMBEDDING_MODEL_VERSION, contentHash]
    );

    if (cached.rows.length > 0) {
      // Parse vector format "[0.01, -0.02, ...]"
      const vecStr = cached.rows[0].embedding;
      return JSON.parse(vecStr);
    }

    // Generate via AI service
    const aiEmbedRes = await generateEmbeddingsWithAi([textToEmbed], EMBEDDING_MODEL_VERSION);
    const vector = aiEmbedRes.embeddings[0];

    // Store in pgvector
    await pool.query(
      `
      INSERT INTO job_embeddings (job_id, model_name, content_hash, embedding)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (job_id, model_name, content_hash) DO NOTHING;
      `,
      [job.id, EMBEDDING_MODEL_VERSION, contentHash, JSON.stringify(vector)]
    );

    return vector;
  }

  /**
   * Get or generate candidate profile embedding with caching.
   */
  public static async ensureCandidateEmbedding(profile: CandidateProfile): Promise<number[]> {
    const candidateId = profile.id;
    if (!candidateId) {
      throw new Error('Candidate profile ID is required for embedding generation.');
    }

    const expText = (profile.experience || [])
      .map((e) => `${e.title} at ${e.company}. ${e.description?.join(' ') || ''}`)
      .join('; ');

    const projText = (profile.projects || [])
      .map((p) => `${p.name}: ${p.description}. Technologies: ${(p.technologies || []).join(', ')}`)
      .join('; ');

    const summaryText = profile.basics?.summary || '';
    const textToEmbed = `${summaryText}. Skills: ${(profile.skills || []).join(', ')}. Experience: ${expText}. Projects: ${projText}`.slice(0, 2500);
    const contentHash = this.hashContent(textToEmbed);

    // Check database cache
    const cached = await pool.query(
      `SELECT embedding::text FROM candidate_embeddings WHERE candidate_id = $1 AND model_name = $2 AND content_hash = $3`,
      [candidateId, EMBEDDING_MODEL_VERSION, contentHash]
    );

    if (cached.rows.length > 0) {
      return JSON.parse(cached.rows[0].embedding);
    }

    // Generate via AI service
    const aiEmbedRes = await generateEmbeddingsWithAi([textToEmbed], EMBEDDING_MODEL_VERSION);
    const vector = aiEmbedRes.embeddings[0];

    // Store in pgvector
    await pool.query(
      `
      INSERT INTO candidate_embeddings (candidate_id, model_name, content_hash, embedding)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (candidate_id, model_name, content_hash) DO NOTHING;
      `,
      [candidateId, EMBEDDING_MODEL_VERSION, contentHash, JSON.stringify(vector)]
    );

    return vector;
  }

  /**
   * Match a candidate profile against a specific job.
   */
  public static async matchCandidateWithJob(
    candidateProfile: CandidateProfile,
    jobId: string
  ): Promise<JobMatchResult> {
    const candidateId = candidateProfile.id;
    if (!candidateId) {
      throw new Error('Candidate profile must have a valid ID.');
    }

    // 1. Fetch Job
    const jobRes = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobRes.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }
    const jobRow = jobRes.rows[0];

    // 2. Ensure Job Analysis
    let analysis: JobAnalysis | null = await this.getJobAnalysis(jobId);
    if (!analysis) {
      try {
        analysis = await this.analyzeJob(jobId);
      } catch (err) {
        logger.warn(`Could not automatically analyze job ${jobId}:`, err);
      }
    }

    const jobRequiredSkills = analysis?.requiredSkills || jobRow.skills || [];
    const jobPreferredSkills = analysis?.preferredSkills || [];
    const jobRole = analysis?.role || jobRow.title;
    const jobExperienceMin = analysis?.experienceMin ?? jobRow.experience_min;
    const jobExperienceMax = analysis?.experienceMax ?? jobRow.experience_max;
    const jobRemoteType = analysis?.remoteType || jobRow.remote_type;

    // 3. Extract & Match Skills
    const candidateSkills = SkillNormalizer.extractCandidateSkills(candidateProfile);
    const skillResult = SkillMatcher.matchSkills(
      candidateSkills,
      jobRequiredSkills,
      jobPreferredSkills
    );

    // 4. Role Match
    const roleResult = RoleMatcher.matchRole(candidateProfile, jobRole, jobRow.title);

    // 5. Experience Match
    const expResult = ExperienceMatcher.matchExperience(
      candidateProfile,
      jobExperienceMin,
      jobExperienceMax
    );

    // 6. Location Match
    const locResult = LocationMatcher.matchLocation(
      candidateProfile,
      jobRow.location,
      jobRemoteType
    );

    // 7. Preference Match
    const prefResult = PreferenceMatcher.matchPreferences(
      candidateProfile,
      jobRow.employment_type,
      jobRow.salary_min ? Number(jobRow.salary_min) : null,
      jobRow.salary_max ? Number(jobRow.salary_max) : null
    );

    // 8. Semantic Similarity (Embeddings)
    let candidateVec: number[] = [];
    let jobVec: number[] = [];

    try {
      candidateVec = await this.ensureCandidateEmbedding(candidateProfile);
      jobVec = await this.ensureJobEmbedding(jobRow, analysis);
    } catch (embedErr) {
      logger.warn(`Embedding generation failed, falling back to neutral semantic score: ${embedErr}`);
    }

    const semanticResult = candidateVec.length > 0 && jobVec.length > 0
      ? SemanticMatcher.matchSemantic(candidateVec, jobVec)
      : { semanticScore: 75, rawSimilarity: 0.6, explanation: 'Semantic similarity estimated.' };

    // 9. Component Aggregation & Weighted Scoring
    const components: MatchComponents = {
      skillMatch: skillResult.skillScore,
      roleMatch: roleResult.roleScore,
      experienceMatch: expResult.experienceScore,
      semanticMatch: semanticResult.semanticScore,
      locationMatch: locResult.locationScore,
      preferenceMatch: prefResult.preferenceScore,
    };

    const { matchScore, penaltyDeducted } = ScoreCalculator.calculateScore(
      components,
      skillResult.missingRequiredSkills.length
    );

    // 10. Generate Grounded Explanation
    const explanationResult = ExplanationGenerator.generate({
      jobTitle: jobRow.title,
      company: jobRow.company,
      components,
      matchedSkills: skillResult.matchedSkills,
      missingRequiredSkills: skillResult.missingRequiredSkills,
      missingPreferredSkills: skillResult.missingPreferredSkills,
      roleExplanation: roleResult.explanation,
      experienceExplanation: expResult.explanation,
      locationExplanation: locResult.explanation,
      preferenceExplanation: prefResult.explanation,
      penaltyDeducted,
    });

    // 11. Upsert into job_matches table
    const upsertRes = await pool.query(
      `
      INSERT INTO job_matches (
        job_id, candidate_id, match_score, components, matched_skills,
        missing_required_skills, missing_preferred_skills, strengths,
        concerns, explanation, model_version, scoring_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (job_id, candidate_id) DO UPDATE SET
        match_score = EXCLUDED.match_score,
        components = EXCLUDED.components,
        matched_skills = EXCLUDED.matched_skills,
        missing_required_skills = EXCLUDED.missing_required_skills,
        missing_preferred_skills = EXCLUDED.missing_preferred_skills,
        strengths = EXCLUDED.strengths,
        concerns = EXCLUDED.concerns,
        explanation = EXCLUDED.explanation,
        model_version = EXCLUDED.model_version,
        scoring_version = EXCLUDED.scoring_version,
        updated_at = NOW()
      RETURNING *;
      `,
      [
        jobId,
        candidateId,
        matchScore,
        JSON.stringify(components),
        JSON.stringify(skillResult.matchedSkills),
        JSON.stringify(skillResult.missingRequiredSkills),
        JSON.stringify(skillResult.missingPreferredSkills),
        JSON.stringify(explanationResult.strengths),
        JSON.stringify(explanationResult.concerns),
        explanationResult.explanation,
        EMBEDDING_MODEL_VERSION,
        SCORING_VERSION,
      ]
    );

    const row = upsertRes.rows[0];

    return {
      id: row.id,
      jobId: row.job_id,
      candidateId: row.candidate_id,
      jobTitle: jobRow.title,
      company: jobRow.company,
      matchScore: row.match_score,
      components,
      matchedSkills: row.matched_skills || [],
      missingRequiredSkills: row.missing_required_skills || [],
      missingPreferredSkills: row.missing_preferred_skills || [],
      strengths: row.strengths || [],
      concerns: row.concerns || [],
      explanation: row.explanation,
      modelVersion: row.model_version,
      scoringVersion: row.scoring_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Recalculate matches for a candidate against all active jobs in batch.
   */
  public static async recalculateAllMatches(candidateId: string): Promise<{ totalMatched: number }> {
    // 1. Fetch verified profile
    const profileRes = await pool.query(
      `SELECT * FROM candidate_profiles WHERE id = $1`,
      [candidateId]
    );

    if (profileRes.rows.length === 0) {
      throw new Error(`Candidate profile not found: ${candidateId}`);
    }

    const pRow = profileRes.rows[0];
    const candidateProfile: CandidateProfile = {
      id: pRow.id,
      userId: pRow.user_id,
      basics: {
        ...pRow.basics,
        summary: pRow.summary || pRow.basics?.summary || null,
      },
      skills: pRow.skills,
      experience: pRow.experience,
      education: pRow.education,
      projects: pRow.projects,
      certifications: pRow.certifications,
      achievements: pRow.achievements,
      preferences: pRow.preferences,
      verificationStatus: pRow.verification_status,
    };

    // 2. Fetch all active jobs
    const jobsRes = await pool.query(
      `SELECT id FROM jobs WHERE status = 'active' ORDER BY posted_at DESC NULLS LAST`
    );

    const jobs = jobsRes.rows;
    logger.info(`Starting batch match calculation for ${jobs.length} jobs for candidate ${candidateId}...`);

    let count = 0;
    for (const job of jobs) {
      try {
        await this.matchCandidateWithJob(candidateProfile, job.id);
        count++;
      } catch (err) {
        logger.error(`Failed to match job ${job.id}:`, err);
      }
    }

    logger.info(`Batch match calculation completed: ${count}/${jobs.length} jobs matched.`);
    return { totalMatched: count };
  }

  /**
   * Get an existing match result.
   */
  public static async getMatchResult(jobId: string, candidateId: string): Promise<JobMatchResult | null> {
    const res = await pool.query(
      `SELECT m.*, j.title AS job_title, j.company AS job_company
       FROM job_matches m
       JOIN jobs j ON j.id = m.job_id
       WHERE m.job_id = $1 AND m.candidate_id = $2`,
      [jobId, candidateId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      jobId: row.job_id,
      candidateId: row.candidate_id,
      jobTitle: row.job_title,
      company: row.job_company,
      matchScore: row.match_score,
      components: row.components,
      matchedSkills: row.matched_skills || [],
      missingRequiredSkills: row.missing_required_skills || [],
      missingPreferredSkills: row.missing_preferred_skills || [],
      strengths: row.strengths || [],
      concerns: row.concerns || [],
      explanation: row.explanation,
      modelVersion: row.model_version,
      scoringVersion: row.scoring_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List match results for a candidate.
   */
  public static async listMatchesForCandidate(candidateId: string, limit: number = 50): Promise<JobMatchResult[]> {
    const res = await pool.query(
      `SELECT m.*, j.title AS job_title, j.company AS job_company
       FROM job_matches m
       JOIN jobs j ON j.id = m.job_id
       WHERE m.candidate_id = $1
       ORDER BY m.match_score DESC
       LIMIT $2`,
      [candidateId, limit]
    );

    return res.rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      candidateId: row.candidate_id,
      jobTitle: row.job_title,
      company: row.job_company,
      matchScore: row.match_score,
      components: row.components,
      matchedSkills: row.matched_skills || [],
      missingRequiredSkills: row.missing_required_skills || [],
      missingPreferredSkills: row.missing_preferred_skills || [],
      strengths: row.strengths || [],
      concerns: row.concerns || [],
      explanation: row.explanation,
      modelVersion: row.model_version,
      scoringVersion: row.scoring_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
