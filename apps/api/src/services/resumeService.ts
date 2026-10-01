import fs from 'fs';
import path from 'path';
import { pool } from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  CandidateProfile,
  CandidatePreferences,
  ResumeMetadata,
  ResumeVersion,
  ResumeProcessingStatus,
} from '@ai-job-hunter/shared';

export class ResumeService {
  /**
   * Register a newly uploaded resume in PostgreSQL.
   */
  public static async registerUpload(
    userId: string,
    file: Express.Multer.File
  ): Promise<ResumeMetadata> {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '') as 'pdf' | 'docx';
    const query = `
      INSERT INTO resumes (user_id, original_filename, storage_path, file_type, file_size, processing_status)
      VALUES ($1, $2, $3, $4, $5, 'uploaded')
      RETURNING id, user_id, original_filename, file_type, file_size, processing_status, error_message, created_at, updated_at;
    `;
    const res = await pool.query(query, [
      userId,
      file.originalname,
      file.path,
      ext,
      file.size,
    ]);

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      originalFilename: row.original_filename,
      fileType: row.file_type,
      fileSize: Number(row.file_size),
      processingStatus: row.processing_status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all resumes for a user.
   */
  public static async listResumes(userId: string): Promise<ResumeMetadata[]> {
    const query = `
      SELECT id, user_id, original_filename, file_type, file_size, processing_status, error_message, created_at, updated_at
      FROM resumes
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const res = await pool.query(query, [userId]);
    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      originalFilename: row.original_filename,
      fileType: row.file_type,
      fileSize: Number(row.file_size),
      processingStatus: row.processing_status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get single resume details.
   */
  public static async getResume(id: string, userId: string): Promise<any | null> {
    const query = `
      SELECT id, user_id, original_filename, storage_path, file_type, file_size, extracted_text, processing_status, error_message, created_at, updated_at
      FROM resumes
      WHERE id = $1 AND user_id = $2;
    `;
    const res = await pool.query(query, [id, userId]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  /**
   * Update resume processing status.
   */
  public static async updateStatus(
    id: string,
    status: ResumeProcessingStatus,
    errorMessage?: string,
    extractedText?: string
  ): Promise<void> {
    const query = `
      UPDATE resumes
      SET processing_status = $1,
          error_message = COALESCE($2, error_message),
          extracted_text = COALESCE($3, extracted_text),
          updated_at = NOW()
      WHERE id = $4;
    `;
    await pool.query(query, [status, errorMessage || null, extractedText || null, id]);
  }

  /**
   * Process resume through text extraction and AI parsing.
   */
  public static async processResume(resumeId: string, userId: string): Promise<CandidateProfile> {
    const resume = await this.getResume(resumeId, userId);
    if (!resume) {
      throw new Error(`Resume not found with ID: ${resumeId}`);
    }

    try {
      // 1. Text Extraction
      await this.updateStatus(resumeId, 'extracting');
      logger.info(`Extracting text for resume ${resumeId}...`);

      const fileBuffer = fs.readFileSync(resume.storage_path);
      const formData = new FormData();
      const blob = new Blob([fileBuffer]);
      formData.append('file', blob, resume.original_filename);
      formData.append('file_type', resume.file_type);

      const aiUrl = config.aiServiceUrl.replace(/\/$/, '');
      const extractRes = await fetch(`${aiUrl}/extract-text`, {
        method: 'POST',
        body: formData,
      });

      if (!extractRes.ok) {
        const errText = await extractRes.text();
        throw new Error(`AI text extraction failed: ${errText}`);
      }

      const extractData = await extractRes.json();
      const extractedText = extractData.text;
      await this.updateStatus(resumeId, 'extracted', undefined, extractedText);

      // 2. AI Parsing
      await this.updateStatus(resumeId, 'parsing');
      logger.info(`Parsing resume text with AI for resume ${resumeId}...`);

      const parseRes = await fetch(`${aiUrl}/parse-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText }),
      });

      if (!parseRes.ok) {
        const errText = await parseRes.text();
        throw new Error(`AI resume parsing failed: ${errText}`);
      }

      const parseData = await parseRes.json();
      const parsedProfile = parseData.data;

      // 3. Persist Candidate Profile & Version
      await this.updateStatus(resumeId, 'needs_review');
      const profile = await this.saveParsedProfile(userId, resumeId, parsedProfile);
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      logger.error(`Resume processing error for ${resumeId}:`, msg);
      await this.updateStatus(resumeId, 'failed', msg);
      throw err;
    }
  }

  /**
   * Save parsed profile into candidate_profiles and create a resume_version.
   */
  public static async saveParsedProfile(
    userId: string,
    resumeId: string,
    profileData: any
  ): Promise<CandidateProfile> {
    // Determine next version number
    const countRes = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver FROM resume_versions WHERE user_id = $1;',
      [userId]
    );
    const nextVer = countRes.rows[0].next_ver;

    // Upsert profile
    const upsertQuery = `
      INSERT INTO candidate_profiles (
        user_id, basics, summary, skills, experience, education, projects, certifications, achievements, verification_status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'needs_review', NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET basics = EXCLUDED.basics,
          summary = EXCLUDED.summary,
          skills = EXCLUDED.skills,
          experience = EXCLUDED.experience,
          education = EXCLUDED.education,
          projects = EXCLUDED.projects,
          certifications = EXCLUDED.certifications,
          achievements = EXCLUDED.achievements,
          verification_status = 'needs_review',
          updated_at = NOW()
      RETURNING *;
    `;

    const profileRes = await pool.query(upsertQuery, [
      userId,
      JSON.stringify(profileData.basics || {}),
      profileData.basics?.summary || null,
      JSON.stringify(profileData.skills || []),
      JSON.stringify(profileData.experience || []),
      JSON.stringify(profileData.education || []),
      JSON.stringify(profileData.projects || []),
      JSON.stringify(profileData.certifications || []),
      JSON.stringify(profileData.achievements || []),
    ]);

    const row = profileRes.rows[0];
    const fullProfile: CandidateProfile = {
      id: row.id,
      userId: row.user_id,
      basics: row.basics,
      skills: row.skills,
      experience: row.experience,
      education: row.education,
      projects: row.projects,
      certifications: row.certifications,
      achievements: row.achievements,
      preferences: row.preferences || {
        preferredRoles: [],
        preferredLocations: [],
        remotePreference: '',
        employmentTypes: [],
        minimumSalary: null,
        maximumSalary: null,
        noticePeriod: '',
        preferredIndustries: [],
      },
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Store version
    await pool.query(
      `INSERT INTO resume_versions (user_id, resume_id, version_number, profile_data)
       VALUES ($1, $2, $3, $4);`,
      [userId, resumeId, nextVer, JSON.stringify(fullProfile)]
    );

    return fullProfile;
  }

  /**
   * Get candidate profile for user.
   */
  public static async getProfile(userId: string): Promise<CandidateProfile | null> {
    const res = await pool.query(
      'SELECT * FROM candidate_profiles WHERE user_id = $1;',
      [userId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      basics: row.basics,
      skills: row.skills,
      experience: row.experience,
      education: row.education,
      projects: row.projects,
      certifications: row.certifications,
      achievements: row.achievements,
      preferences: row.preferences || {
        preferredRoles: [],
        preferredLocations: [],
        remotePreference: '',
        employmentTypes: [],
        minimumSalary: null,
        maximumSalary: null,
        noticePeriod: '',
        preferredIndustries: [],
      },
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * User explicitly saves/verifies their profile.
   */
  public static async saveVerifiedProfile(
    userId: string,
    profileData: Partial<CandidateProfile>
  ): Promise<CandidateProfile> {
    const current = await this.getProfile(userId);

    const merged = {
      basics: profileData.basics || current?.basics || {},
      skills: profileData.skills || current?.skills || [],
      experience: profileData.experience || current?.experience || [],
      education: profileData.education || current?.education || [],
      projects: profileData.projects || current?.projects || [],
      certifications: profileData.certifications || current?.certifications || [],
      achievements: profileData.achievements || current?.achievements || [],
      preferences: profileData.preferences || current?.preferences || {},
    };

    const upsertQuery = `
      INSERT INTO candidate_profiles (
        user_id, basics, summary, skills, experience, education, projects, certifications, achievements, preferences, verification_status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'verified', NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET basics = EXCLUDED.basics,
          summary = EXCLUDED.summary,
          skills = EXCLUDED.skills,
          experience = EXCLUDED.experience,
          education = EXCLUDED.education,
          projects = EXCLUDED.projects,
          certifications = EXCLUDED.certifications,
          achievements = EXCLUDED.achievements,
          preferences = EXCLUDED.preferences,
          verification_status = 'verified',
          updated_at = NOW()
      RETURNING *;
    `;

    const res = await pool.query(upsertQuery, [
      userId,
      JSON.stringify(merged.basics),
      (merged.basics as any)?.summary || null,
      JSON.stringify(merged.skills),
      JSON.stringify(merged.experience),
      JSON.stringify(merged.education),
      JSON.stringify(merged.projects),
      JSON.stringify(merged.certifications),
      JSON.stringify(merged.achievements),
      JSON.stringify(merged.preferences),
    ]);

    const row = res.rows[0];
    const verifiedProfile: CandidateProfile = {
      id: row.id,
      userId: row.user_id,
      basics: row.basics,
      skills: row.skills,
      experience: row.experience,
      education: row.education,
      projects: row.projects,
      certifications: row.certifications,
      achievements: row.achievements,
      preferences: row.preferences,
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Increment version upon explicit user verification
    const countRes = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver FROM resume_versions WHERE user_id = $1;',
      [userId]
    );
    const nextVer = countRes.rows[0].next_ver;

    await pool.query(
      `INSERT INTO resume_versions (user_id, version_number, profile_data)
       VALUES ($1, $2, $3);`,
      [userId, nextVer, JSON.stringify(verifiedProfile)]
    );

    return verifiedProfile;
  }

  /**
   * Update preferences only.
   */
  public static async updatePreferences(
    userId: string,
    preferences: CandidatePreferences
  ): Promise<CandidatePreferences> {
    await pool.query(
      `UPDATE candidate_profiles
       SET preferences = $1, updated_at = NOW()
       WHERE user_id = $2;`,
      [JSON.stringify(preferences), userId]
    );
    return preferences;
  }

  /**
   * Get version history.
   */
  public static async getVersions(userId: string): Promise<ResumeVersion[]> {
    const res = await pool.query(
      `SELECT id, user_id, resume_id, version_number, profile_data, created_at
       FROM resume_versions
       WHERE user_id = $1
       ORDER BY version_number DESC;`,
      [userId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      resumeId: r.resume_id,
      versionNumber: r.version_number,
      profileData: r.profile_data,
      createdAt: r.created_at,
    }));
  }

  /**
   * Delete resume record and stored file.
   */
  public static async deleteResume(id: string, userId: string): Promise<boolean> {
    const resume = await this.getResume(id, userId);
    if (!resume) return false;

    if (resume.storage_path && fs.existsSync(resume.storage_path)) {
      try {
        fs.unlinkSync(resume.storage_path);
      } catch (e) {
        logger.error(`Error removing file at ${resume.storage_path}:`, e);
      }
    }

    await pool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2;', [id, userId]);
    return true;
  }
}
