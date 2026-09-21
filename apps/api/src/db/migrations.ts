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

    // ==========================================
    // Step 4: AI Job Matching Tables
    // ==========================================

    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // 8. job_analyses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE UNIQUE,
        role VARCHAR(255) NOT NULL,
        seniority VARCHAR(50),
        required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        preferred_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
        education_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
        experience_min INT,
        experience_max INT,
        remote_type VARCHAR(50),
        model_used VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_analyses_job ON job_analyses(job_id);
    `);

    // 9. candidate_embeddings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS candidate_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        model_name VARCHAR(100) NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        embedding vector(384) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_candidate_embeddings_hash UNIQUE (candidate_id, model_name, content_hash)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candidate_embeddings_lookup ON candidate_embeddings(candidate_id, model_name);
    `);

    // 10. job_embeddings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        model_name VARCHAR(100) NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        embedding vector(384) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_job_embeddings_hash UNIQUE (job_id, model_name, content_hash)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_embeddings_lookup ON job_embeddings(job_id, model_name);
    `);

    // 11. job_matches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        match_score INT NOT NULL,
        components JSONB NOT NULL DEFAULT '{}'::jsonb,
        matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        missing_required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        missing_preferred_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
        concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
        explanation TEXT NOT NULL,
        model_version VARCHAR(100) NOT NULL,
        scoring_version VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_job_candidate_match UNIQUE (job_id, candidate_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_matches_candidate_score ON job_matches(candidate_id, match_score DESC);
      CREATE INDEX IF NOT EXISTS idx_job_matches_job ON job_matches(job_id);
    `);

    // ==========================================
    // Step 5: Resume Tailoring & Cover Letters
    // ==========================================

    // 12. tailored_resumes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tailored_resumes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        base_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
        version_number INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        resume_data JSONB NOT NULL,
        tailoring_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
        ats_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
        validation_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'completed',
        instructions TEXT,
        model_version VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tailored_resumes_job ON tailored_resumes(job_id, user_id, version_number DESC);
      CREATE INDEX IF NOT EXISTS idx_tailored_resumes_user ON tailored_resumes(user_id, created_at DESC);
    `);

    // 13. cover_letters table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cover_letters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        base_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
        version_number INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        tone VARCHAR(50) NOT NULL DEFAULT 'professional',
        instructions TEXT,
        model_version VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cover_letters_job ON cover_letters(job_id, user_id, version_number DESC);
      CREATE INDEX IF NOT EXISTS idx_cover_letters_user ON cover_letters(user_id, created_at DESC);
    `);

    // 14. resume_generation_runs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS resume_generation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        base_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        model_version VARCHAR(100) NOT NULL,
        prompt_version VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        error_message TEXT
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gen_runs_user_job ON resume_generation_runs(user_id, job_id, created_at DESC);
    `);

    // ==========================================
    // Step 6: Dashboard + Application Tracker
    // ==========================================

    // 15. applications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'SAVED',
        saved_at TIMESTAMPTZ,
        shortlisted_at TIMESTAMPTZ,
        ready_at TIMESTAMPTZ,
        applied_at TIMESTAMPTZ,
        interview_at TIMESTAMPTZ,
        offer_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ,
        withdrawn_at TIMESTAMPTZ,
        last_updated_at TIMESTAMPTZ DEFAULT NOW(),
        next_follow_up_at TIMESTAMPTZ,
        external_application_url TEXT,
        resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
        tailored_resume_id UUID REFERENCES tailored_resumes(id) ON DELETE SET NULL,
        cover_letter_id UUID REFERENCES cover_letters(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_user_job_active 
        ON applications (user_id, job_id) WHERE status != 'WITHDRAWN';
      CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
      CREATE INDEX IF NOT EXISTS idx_applications_followup ON applications(user_id, next_follow_up_at);
      CREATE INDEX IF NOT EXISTS idx_applications_updated ON applications(user_id, last_updated_at DESC);
    `);

    // 16. application_events table (Chronological Timeline History)
    await client.query(`
      CREATE TABLE IF NOT EXISTS application_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_app_events_app_timeline ON application_events(application_id, created_at ASC);
    `);

    // 17. gmail_connections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gmail_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        email_address VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expires_at TIMESTAMPTZ NOT NULL,
        scopes TEXT[] NOT NULL DEFAULT '{}',
        is_connected BOOLEAN NOT NULL DEFAULT true,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_gmail_connections_user ON gmail_connections(user_id);
    `);

    // 18. emails table
    await client.query(`
      CREATE TABLE IF NOT EXISTS emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
        application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
        gmail_message_id VARCHAR(255) NOT NULL,
        thread_id VARCHAR(255),
        sender VARCHAR(512) NOT NULL,
        sender_email VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255),
        recipient VARCHAR(512) NOT NULL,
        cc TEXT[] DEFAULT '{}',
        subject VARCHAR(1024) NOT NULL,
        snippet TEXT,
        body_text TEXT,
        body_html TEXT,
        direction VARCHAR(20) NOT NULL DEFAULT 'INBOUND',
        category VARCHAR(50) NOT NULL DEFAULT 'OTHER',
        confidence NUMERIC(4, 3) DEFAULT 1.0,
        suggested_status VARCHAR(50),
        status_suggestion_handled BOOLEAN DEFAULT false,
        requires_response BOOLEAN DEFAULT false,
        is_read BOOLEAN NOT NULL DEFAULT false,
        received_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_emails_user_gmail_msg ON emails(user_id, gmail_message_id);
      CREATE INDEX IF NOT EXISTS idx_emails_user_received ON emails(user_id, received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_emails_app ON emails(application_id);
      CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(user_id, category);
      CREATE INDEX IF NOT EXISTS idx_emails_sender_email ON emails(user_id, sender_email);
    `);

    // 19. email_drafts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_drafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
        reply_to_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
        purpose VARCHAR(50) NOT NULL,
        tone VARCHAR(50) NOT NULL DEFAULT 'professional',
        recipient VARCHAR(512) NOT NULL,
        cc TEXT[] DEFAULT '{}',
        subject VARCHAR(1024) NOT NULL,
        body TEXT NOT NULL,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_email_drafts_user ON email_drafts(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_email_drafts_app ON email_drafts(application_id);
    `);

    // 20. application_contacts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS application_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        company VARCHAR(255),
        linkedin_url VARCHAR(512),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_contacts_app ON application_contacts(application_id);
      CREATE INDEX IF NOT EXISTS idx_app_contacts_email ON application_contacts(email);
    `);

    // ==========================================
    // Step 8: Automation + Real AI Job Hunter
    // ==========================================

    // Extend job_sources with capability model columns
    await client.query(`
      ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS automated_application_allowed BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS browser_automation_allowed BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS application_mode VARCHAR(50) NOT NULL DEFAULT 'MANUAL_ONLY';
      ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS requires_human_approval BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS requires_authentication BOOLEAN NOT NULL DEFAULT false;
    `);

    // Seed/Update source capabilities for both automatable and manual-only sources
    await client.query(`
      UPDATE job_sources SET 
        automated_application_allowed = true,
        browser_automation_allowed = true,
        application_mode = 'AUTOMATED',
        requires_human_approval = false
      WHERE id = 'mock';

      UPDATE job_sources SET 
        automated_application_allowed = false,
        browser_automation_allowed = false,
        application_mode = 'MANUAL_ONLY',
        requires_human_approval = true
      WHERE id = 'arbeitnow';

      INSERT INTO job_sources (id, name, slug, enabled, api_available, public_feed_available, automated_collection_allowed, automated_application_allowed, browser_automation_allowed, application_mode, requires_human_approval, rate_limit_delay_ms)
      VALUES 
        ('remoteok', 'RemoteOK', 'remoteok', true, true, true, true, false, false, 'MANUAL_ONLY', true, 2000),
        ('himalayas', 'Himalayas', 'himalayas', true, true, true, true, false, false, 'MANUAL_ONLY', true, 2000),
        ('wellfound', 'Wellfound (AngelList)', 'wellfound', false, false, false, false, false, false, 'MANUAL_ONLY', true, 3000),
        ('weworkremotely', 'We Work Remotely', 'weworkremotely', false, false, false, false, false, false, 'MANUAL_ONLY', true, 3000),
        ('linkedin', 'LinkedIn Jobs', 'linkedin', false, false, false, false, false, false, 'MANUAL_ONLY', true, 5000),
        ('naukri', 'Naukri', 'naukri', false, false, false, false, false, false, 'MANUAL_ONLY', true, 5000)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          api_available = EXCLUDED.api_available,
          public_feed_available = EXCLUDED.public_feed_available,
          automated_collection_allowed = EXCLUDED.automated_collection_allowed,
          automated_application_allowed = EXCLUDED.automated_application_allowed,
          application_mode = EXCLUDED.application_mode,
          requires_human_approval = EXCLUDED.requires_human_approval;
    `);

    // 21. automation_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        automation_enabled BOOLEAN NOT NULL DEFAULT false,
        mode VARCHAR(50) NOT NULL DEFAULT 'ASSISTED',
        sync_frequency_hours INT NOT NULL DEFAULT 6,
        auto_shortlisting_enabled BOOLEAN NOT NULL DEFAULT true,
        auto_tailoring_enabled BOOLEAN NOT NULL DEFAULT true,
        auto_cover_letter_enabled BOOLEAN NOT NULL DEFAULT true,
        application_approval_required BOOLEAN NOT NULL DEFAULT true,
        email_approval_required BOOLEAN NOT NULL DEFAULT true,
        browser_automation_enabled BOOLEAN NOT NULL DEFAULT false,
        daily_application_limit INT NOT NULL DEFAULT 5,
        hourly_application_limit INT NOT NULL DEFAULT 2,
        minimum_match_score INT NOT NULL DEFAULT 80,
        minimum_skill_match INT NOT NULL DEFAULT 70,
        kill_switch_active BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_automation_settings_user ON automation_settings(user_id);
    `);

    // Seed default automation settings for default user
    await client.query(`
      INSERT INTO automation_settings (user_id, automation_enabled, mode, sync_frequency_hours, auto_shortlisting_enabled, auto_tailoring_enabled, auto_cover_letter_enabled, application_approval_required, email_approval_required, browser_automation_enabled, daily_application_limit, hourly_application_limit, minimum_match_score, minimum_skill_match, kill_switch_active)
      VALUES ('00000000-0000-0000-0000-000000000001', false, 'ASSISTED', 6, true, true, true, true, true, false, 5, 2, 80, 70, false)
      ON CONFLICT (user_id) DO NOTHING;
    `);

    // 22. job_search_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_search_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        skills TEXT[] NOT NULL DEFAULT '{}',
        locations TEXT[] NOT NULL DEFAULT '{}',
        remote_types TEXT[] NOT NULL DEFAULT '{}',
        employment_types TEXT[] NOT NULL DEFAULT '{}',
        experience_min INT,
        experience_max INT,
        salary_min NUMERIC,
        salary_currency VARCHAR(10) DEFAULT 'USD',
        industries TEXT[] NOT NULL DEFAULT '{}',
        sources TEXT[] NOT NULL DEFAULT '{}',
        minimum_match_score INT NOT NULL DEFAULT 80,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_search_profiles_user ON job_search_profiles(user_id, enabled);
    `);

    // 23. automation_runs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
        run_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        items_processed INT NOT NULL DEFAULT 0,
        items_succeeded INT NOT NULL DEFAULT 0,
        items_failed INT NOT NULL DEFAULT 0,
        error_summary TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_automation_runs_user_status ON automation_runs(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_automation_runs_created ON automation_runs(user_id, created_at DESC);
    `);

    // 24. automation_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        automation_run_id UUID REFERENCES automation_runs(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
        job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
        application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_automation_events_run ON automation_events(automation_run_id);
      CREATE INDEX IF NOT EXISTS idx_automation_events_app ON automation_events(application_id);
      CREATE INDEX IF NOT EXISTS idx_automation_events_user_created ON automation_events(user_id, created_at DESC);
    `);

    // 25. application_preparations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS application_preparations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        source VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PREPARING',
        resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
        tailored_resume_id UUID REFERENCES tailored_resumes(id) ON DELETE SET NULL,
        cover_letter_id UUID REFERENCES cover_letters(id) ON DELETE SET NULL,
        prepared_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        missing_answers TEXT[] NOT NULL DEFAULT '{}',
        warnings TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_preparations_user_status ON application_preparations(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_app_preparations_app ON application_preparations(application_id);
    `);

    // 26. application_questions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS application_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_preparation_id UUID NOT NULL REFERENCES application_preparations(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        question_type VARCHAR(50) NOT NULL DEFAULT 'text',
        candidate_answer TEXT,
        answer_source VARCHAR(50) NOT NULL DEFAULT 'GENERATED',
        confidence NUMERIC(4,3) DEFAULT 1.0,
        requires_user_input BOOLEAN NOT NULL DEFAULT false,
        is_sensitive BOOLEAN NOT NULL DEFAULT false,
        options JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_questions_prep ON application_questions(application_preparation_id);
    `);

    // 27. application_submissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS application_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        automation_run_id UUID REFERENCES automation_runs(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
        source_application_id VARCHAR(255),
        confirmation_url VARCHAR(1024),
        confirmation_text TEXT,
        error TEXT,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_submissions_app ON application_submissions(application_id, submitted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_submissions_user ON application_submissions(user_id, submitted_at DESC);
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
