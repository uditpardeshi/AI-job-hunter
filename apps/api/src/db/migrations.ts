import { pool } from './index';
import { logger } from '../utils/logger';

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info('Running database migrations...');
    await client.query('BEGIN');

    // Enable pgcrypto / uuid extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 1. users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default developer user
    await client.query(`
      INSERT INTO users (id, email, name)
      VALUES ($1, 'developer@aijobhunter.local', 'Developer User')
      ON CONFLICT (id) DO NOTHING;
    `, [DEFAULT_USER_ID]);

    // 2. resumes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS resumes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_filename VARCHAR(255) NOT NULL,
        storage_path VARCHAR(512) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size BIGINT NOT NULL,
        extracted_text TEXT,
        processing_status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. candidate_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS candidate_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        basics JSONB NOT NULL DEFAULT '{}'::jsonb,
        summary TEXT,
        skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        experience JSONB NOT NULL DEFAULT '[]'::jsonb,
        education JSONB NOT NULL DEFAULT '[]'::jsonb,
        projects JSONB NOT NULL DEFAULT '[]'::jsonb,
        certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
        achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
        verification_status VARCHAR(50) NOT NULL DEFAULT 'needs_review',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. resume_versions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS resume_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
        version_number INT NOT NULL,
        profile_data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ==========================================
    // Step 3: Job Collection Tables
    // ==========================================

    // 5. job_sources table
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_sources (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        api_available BOOLEAN NOT NULL DEFAULT false,
        public_feed_available BOOLEAN NOT NULL DEFAULT false,
        automated_collection_allowed BOOLEAN NOT NULL DEFAULT true,
        rate_limit_delay_ms INT NOT NULL DEFAULT 1000,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default sources: 'mock' and 'arbeitnow'
    await client.query(`
      INSERT INTO job_sources (id, name, slug, enabled, api_available, public_feed_available, automated_collection_allowed, rate_limit_delay_ms)
      VALUES 
        ('mock', 'Mock Job Provider', 'mock', true, true, false, true, 0),
        ('arbeitnow', 'Arbeitnow Jobs API', 'arbeitnow', true, true, true, true, 1000)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          api_available = EXCLUDED.api_available,
          public_feed_available = EXCLUDED.public_feed_available,
          automated_collection_allowed = EXCLUDED.automated_collection_allowed;
    `);

    // 6. jobs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id VARCHAR(50) NOT NULL REFERENCES job_sources(id) ON DELETE CASCADE,
        source_job_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        company_url VARCHAR(512),
        job_url VARCHAR(1024),
        location VARCHAR(255),
        remote_type VARCHAR(50) NOT NULL DEFAULT 'unknown',
        employment_type VARCHAR(50) NOT NULL DEFAULT 'unknown',
        description TEXT NOT NULL,
        salary_min NUMERIC,
        salary_max NUMERIC,
        salary_currency VARCHAR(10),
        experience_min INT,
        experience_max INT,
        posted_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        first_seen_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_jobs_source_job UNIQUE (source_id, source_job_id)
      );
    `);

    // Indexes for high performance querying & deduplication
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_source_lookup ON jobs(source_id, source_job_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_dedup_title_company ON jobs(LOWER(company), LOWER(title));
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_remote_type ON jobs(remote_type);
      CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);
    `);

    // 7. job_source_syncs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_source_syncs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id VARCHAR(50) NOT NULL REFERENCES job_sources(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        status VARCHAR(50) NOT NULL DEFAULT 'running',
        jobs_found INT NOT NULL DEFAULT 0,
        jobs_created INT NOT NULL DEFAULT 0,
        jobs_updated INT NOT NULL DEFAULT 0,
        jobs_skipped INT NOT NULL DEFAULT 0,
        error_message TEXT
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_syncs_source_date ON job_source_syncs(source_id, started_at DESC);
    `);

    await client.query('COMMIT');
    logger.info('Database migrations completed successfully.');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : 'Unknown migration error';
    logger.error('Database migration failed:', msg);
    throw err;
  } finally {
    client.release();
  }
}
