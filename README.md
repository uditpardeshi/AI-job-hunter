# AI Job Hunter - Step 1: Foundation

AI Job Hunter is an intelligent agentic platform for discovering, evaluating, and applying to job opportunities. This repository contains the foundational microservices architecture.

## System Architecture

```text
Browser User
   ↓
apps/web (Next.js 14 + Tailwind CSS) [Port 3000]
   ├── / (System Health Dashboard)
   ├── /resume (Resume Upload, Candidate Profile Review & Verification)
   ├── /jobs (Job Search, Discovery & Ingestion)
   ├── /applications (Application Tracker Kanban & Table)
   ├── /emails (Recruiter Inbox & Assistant)
   └── /settings/integrations (Gmail OAuth & Sync Management)
   ↓
apps/api (Express + TypeScript API Gateway) [Port 4000]
   ├── postgres (PostgreSQL 16) [Port 5432]
   │     └── Tables: users, resumes, candidate_profiles, resume_versions, jobs, job_sources, sync_logs, candidate_embeddings, job_embeddings, job_matches, tailored_resumes, tailored_resume_versions, cover_letters, cover_letter_versions, applications, application_events, gmail_connections, emails, email_drafts, application_contacts
   ├── redis (Redis 7 In-Memory Cache) [Port 6379]
   └── services/ai (FastAPI + Python AI Microservice) [Port 8000]
         ├── PyMuPDF & python-docx Text Extractors & Exporters
         ├── Zero-Invention Resume Parser & Tailoring Engine
         ├── Email Classification & Zero-Fabrication Assistant
         └── ollama (Local LLM Engine) [Port 11434]
```

## Step 8: Automation + Real AI Job Hunter

Step 8 turns AI Job Hunter into an autonomous, safe, and fully audited job-hunting assistant. It coordinates scheduled job discovery, multi-source ingestion, AI semantic matching, search profile filtering, auto-shortlisting, grounded material generation, application preparation, and human-in-the-loop approval queues with global emergency kill switch safety controls.

```text
Job Discovery (BullMQ Queue)
          ↓
Deduplication & Normalization (PostgreSQL + Redis)
          ↓
AI Matching & Scoring (Ollama + all-MiniLM-L6-v2)
          ↓
Search Profile Evaluation (Roles, Skills, Salary, Match Score)
          ↓
Auto-Shortlisting (applications: SHORTLISTED)
          ↓
Materials Generation (Tailored Resume + Targeted Cover Letter)
          ↓
Application Preparation & Questions Extraction (application_preparations)
          ↓
Sensitive Question & Anti-Fabrication Guard (Requires Explicit User Input)
          ↓
Human Approval Queue (/approvals)
          ↓
Approval & Submission (Permitted Source Connector / External Guidance)
          ↓
Audit Trail & Timeline Logging (automation_events & application_submissions)
```

### Core Safety Guardrails & Compliance

1. **Assisted Default & Human Approval**:
   - `applicationApprovalRequired = true` by default.
   - Applications strictly require human review before external submission via the `/approvals` command center.
2. **Zero Fabrication on Sensitive Fields**:
   - Demographic, visa sponsorship, legal authorization, and compensation questions are never guessed or hallucinated (`requiresUserInput = true`, `isSensitive = true`).
   - Profile facts are pulled exclusively from verified candidate profile data (`CANDIDATE_PROFILE`).
3. **Emergency Kill Switch**:
   - A global kill switch (`POST /api/automation/kill-switch` or button in UI) halts all background runs, syncs, auto-shortlisting, and submissions immediately.
4. **Source Capability Model & Anti-Bot Respect**:
   - Each job source has explicit capabilities (`AUTOMATED`, `MANUAL_ONLY`, `UNSUPPORTED`).
   - Prohibited or manual-only sources (`Arbeitnow`, `RemoteOK`, `Himalayas`, `LinkedIn`, `Wellfound`, `Naukri`) provide direct job URLs and prepared materials for manual submission without bypassing anti-bot protections or TOS.
   - Automated submission simulation is available via `MockApplicationConnector` (`AUTOMATION_ENV=development`).
5. **Rate Limiting & Safety Pacing**:
   - Configurable daily limit (default: 5) and hourly limit (default: 2) prevent quota exhaustion and portal spamming.

### Step 8 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/automation/settings` | Get user automation settings & safety limits |
| `PUT` | `/api/automation/settings` | Update settings (mode, limits, thresholds, toggles) |
| `POST` | `/api/automation/kill-switch` | Engage global emergency kill switch (pauses all automation) |
| `POST` | `/api/automation/resume` | Deactivate kill switch and resume normal operations |
| `GET` | `/api/automation/summary` | Aggregate stats (today's discoveries, matches, pending approvals) |
| `POST` | `/api/automation/run` | Trigger automation pipeline (direct or via BullMQ queue) |
| `GET` | `/api/automation/runs` | List execution history and status |
| `GET` | `/api/automation/runs/:id` | Get details and error summary for a run |
| `GET` | `/api/automation/events` | Audit trail of pipeline events (`JOB_DISCOVERED`, `JOB_SHORTLISTED`, etc.) |
| `GET` | `/api/automation/profiles` | List candidate job search targeting profiles |
| `POST` | `/api/automation/profiles` | Create new search profile with roles, skills, and minimum match score |
| `GET` | `/api/automation/profiles/:id` | Get single search profile |
| `PUT` | `/api/automation/profiles/:id` | Update search profile criteria or toggle active status |
| `DELETE` | `/api/automation/profiles/:id` | Delete search profile |
| `GET` | `/api/approvals` | List application packages awaiting human review |
| `GET` | `/api/approvals/:id` | Get application preparation details and question answers |
| `PUT` | `/api/approvals/:id/answers` | Update candidate answers to application questions |
| `POST` | `/api/approvals/:id/approve` | Approve application for submission (or get manual apply guidance) |
| `POST` | `/api/approvals/:id/reject` | Reject application from queue with optional reason |

## Step 7: Email + Application Assistant

Step 7 adds a controlled email integration and communication assistant to AI Job Hunter. It enables candidates to connect Gmail securely via OAuth 2.0, synchronize and classify recruiter messages, match emails to applications, review status change suggestions, generate zero-fabrication draft responses, manage recruiter contacts, and send emails explicitly through Gmail with application material attachments.

### Core Architecture & Privacy Principles

1. **User In Total Control**:
   - The system **never automatically sends an email**. Sending occurs ONLY upon an explicit user click (`POST /api/emails/send`).
   - The system **never silently changes application statuses**. AI status suggestions (`INTERVIEW`, `OFFER`, `REJECTED`) require explicit user confirmation (`[Accept]` / `[Ignore]`).
2. **AES-256-GCM Token Encryption At Rest**:
   - OAuth access and refresh tokens are encrypted at rest using AES-256-GCM via `TokenEncryptionService`.
   - Tokens are **strictly never returned in API responses** or logged.
3. **Prompt Injection Defense & Zero Fabrication**:
   - Email classification and draft generation system prompts wrap external email content in `<EMAIL_CONTENT>` tags and enforce strict prompt boundaries.
   - The drafting engine never invents interview availability, technical skills, or interviewer details. Placeholders (e.g. `[Available Date/Time]`) are used where user input is required.
4. **Idempotent Synchronization**:
   - Messages are synced manually (`POST /api/integrations/gmail/sync`).
   - Unique index `uq_emails_user_gmail_msg` prevents duplicates on repeat syncs.
5. **Timeline Integration**:
   - Synchronized recruiter emails and outbound sent messages are immutably recorded in `application_events` (`APPLICATION_EMAIL_RECEIVED`, `EMAIL_SENT`).

### Step 7 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/integrations/gmail` | Check connection status (tokens strictly stripped) |
| `GET` | `/api/integrations/gmail/connect` | Generate OAuth 2.0 authorization URL with CSRF state token |
| `GET` | `/api/integrations/gmail/callback` | OAuth redirect callback handler (exchanges code & encrypts tokens) |
| `POST` | `/api/integrations/gmail/sync` | Manually sync recruiter emails from Gmail (idempotent) |
| `DELETE` | `/api/integrations/gmail` | Disconnect Gmail and remove credentials |
| `GET` | `/api/emails` | List synced emails with category, search, and application filters |
| `GET` | `/api/emails/:id` | Get email details, body text, and linked application |
| `POST` | `/api/emails/:id/associate` | Associate email with an application |
| `POST` | `/api/emails/:id/suggestion` | Accept or ignore an AI suggested application status change |
| `POST` | `/api/emails/generate` | Generate contextual draft via AI service (zero-fabrication) |
| `GET` | `/api/emails/drafts` | List saved email drafts |
| `POST` | `/api/emails/drafts` | Save or update draft message |
| `POST` | `/api/emails/send` | Send email via Gmail API with attachments (explicit user approval) |
| `GET` | `/api/applications/:id/contacts` | List recruiter contacts for an application |
| `POST` | `/api/applications/:id/contacts` | Create recruiter contact |
| `DELETE` | `/api/applications/:id/contacts/:cid` | Remove recruiter contact |

## Step 6: Dashboard + Application Tracker

Step 6 turns AI Job Hunter into a complete, usable job-search command center. It provides end-to-end tracking across an 8-stage application lifecycle, interactive Kanban & Table views, an Application Hub for linked materials and follow-up reminders, and search analytics.

### Application Lifecycle Flow
```text
Job Discovery (/jobs)
       ↓
Save / Shortlist (SAVED / SHORTLISTED)
       ↓
Analyze / Match (Step 4 Scoring & Skill Gaps)
       ↓
Tailor Resume & Cover Letter (Step 5 Grounded Materials)
       ↓
Mark as Ready (READY)
       ↓
Candidate Applies Externally → Mark as Applied (APPLIED)
       ↓
Track Interviews & Notes (INTERVIEW)
       ↓
Outcomes (OFFER / REJECTED / WITHDRAWN)
```

### Core Capabilities
1. **Candidate-Controlled Lifecycle**: The user remains in full control. The system never applies automatically or emails without explicit candidate actions.
2. **8 Dedicated Lifecycle Stages**:
   - `SAVED`: Discovered opportunity saved for later review.
   - `SHORTLISTED`: Priority match targeted for preparation.
   - `READY`: Tailored resume and cover letter prepared; ready to apply.
   - `APPLIED`: Submitted by candidate; tracks submission date and active timeline.
   - `INTERVIEW`: Screening or technical interviews in progress.
   - `OFFER`: Offer received.
   - `REJECTED`: Application not selected.
   - `WITHDRAWN`: Candidate voluntarily withdrew from consideration.
3. **Partial Unique Index (`uq_applications_user_job_active`)**: Prevents duplicate active applications for the same job and user while permitting re-applications if a prior cycle was withdrawn.
4. **Follow-Up Reminders & Scheduler**: Set, update, and complete follow-up dates with automatic highlighting on the dashboard for upcoming deadlines.
5. **Free-Form Notes & Immutable Timeline**: Append chronological recruiter notes and interview insights. Every status transition, note, and attachment is recorded in `application_events`.
6. **Dual-View Tracker (`/applications`)**:
   - **Kanban Board**: Drag-and-drop or select-to-move cards across 8 visual workflow columns.
   - **Table View**: Compact, sortable, and searchable list with direct links to Job and Application Hubs.
7. **Comprehensive Search Analytics (`/dashboard`)**:
   - 8 KPI cards with quick status filters.
   - Interview rate and offer conversion rates.
   - Upcoming follow-up deadlines alert widget.
   - 14-day application trajectory chart.

### Step 6 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Aggregated dashboard stats, recent applications, follow-ups, and analytics |
| `GET` | `/api/applications` | List applications with status, search, company, follow-up filters, and pagination |
| `POST` | `/api/applications` | Create a tracked application (prevents active duplicates; records timeline) |
| `GET` | `/api/applications/:id` | Get application details, job info, match score, tailored materials, and timeline |
| `PUT` | `/api/applications/:id` | Update application fields (notes, URLs, resume/cover letter links) |
| `DELETE` | `/api/applications/:id` | Delete application record and associated timeline events |
| `PATCH` | `/api/applications/:id/status` | Transition status across 8 stages (records stage timestamp and timeline event) |
| `PATCH` | `/api/applications/:id/follow-up`| Schedule or complete follow-up reminder date |
| `POST` | `/api/applications/:id/notes` | Append a free-form timestamped note and timeline event |
| `GET` | `/api/applications/:id/timeline` | Get chronological immutable activity history (`application_events`) |

---

Step 5 provides job-customized application material generation grounded strictly in the candidate's verified profile facts, paired with comprehensive ATS keyword alignment, anti-fabrication auditing, interactive web studios, and native vector PDF/DOCX binary document exports.

### Core Principles
1. **Zero Fabrication**: The system never invents skills, companies, degrees, metrics, or technologies that the candidate does not have in their verified profile.
2. **Anti-Fabrication Guard (`AntiFabricationValidator`)**: Systematically audits all tailored drafts against verified profile items and flags any unverified skills or employer claims. The UI allows candidates to either remove unverified items or confirm them as candidate-provided facts.
3. **Non-Destructive Versioning**: The original base resume is never overwritten. Tailored resumes are stored as versioned drafts (`tailored_resumes`), each referencing the job and user with monotonic version numbering (`v1`, `v2`, ...).
4. **ATS Alignment Transparency**: Provides an "ATS Alignment Score" based on keyword coverage and standard section formatting checks. Never marketed as an "ATS Guarantee", and accompanied by a clear heuristic disclaimer.
5. **Native Vector Exports**: Direct generation of clean, single-page capable ATS vector PDFs via PyMuPDF (`fitz`) and formatted Word documents via `python-docx` without browser headlessness or HTML rendering overhead.

### Step 5 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/jobs/:jobId/tailor-resume` | Generate a job-tailored resume draft grounded strictly in verified candidate facts |
| `GET` | `/api/jobs/:jobId/tailored-resumes` | List all tailored resume versions generated for a specific job |
| `GET` | `/api/tailored-resumes/:id` | Retrieve full tailored resume draft with ATS score, changelog, and flags |
| `PUT` | `/api/tailored-resumes/:id` | Save candidate edits to tailored resume (re-audits factual alignment) |
| `POST` | `/api/tailored-resumes/:id/validate` | Run on-demand anti-fabrication and ATS alignment audit on draft |
| `GET` | `/api/tailored-resumes/:id/ats-analysis` | Get granular ATS keyword match breakdown and recommendations |
| `GET` | `/api/tailored-resumes/:id/export/pdf` | Download ATS-friendly native vector PDF |
| `GET` | `/api/tailored-resumes/:id/export/docx` | Download editable Microsoft Word DOCX |
| `POST` | `/api/jobs/:jobId/cover-letter` | Generate a role-grounded cover letter in specified tone |
| `GET` | `/api/jobs/:jobId/cover-letters` | List cover letter drafts generated for a specific job |
| `GET` | `/api/cover-letters/:id` | Retrieve cover letter content, tone, and audit trail |
| `PUT` | `/api/cover-letters/:id` | Save manual edits to cover letter body or tone |
| `GET` | `/api/cover-letters/:id/export/pdf` | Download cover letter as vector PDF |
| `GET` | `/api/cover-letters/:id/export/docx` | Download cover letter as Microsoft Word DOCX |

---

## Step 4: AI Job Matching Features

### Architecture & Matching Flow
```text
Candidate Profile
       │
       ├──────────────┐
       │              │
       ▼              ▼
Structured Data    Embeddings (all-MiniLM-L6-v2)
       │              │
       └──────┬───────┘
              ▼
        Matching Engine
              ▲
              │
       ┌──────┴───────┐
       │              │
Job Structured Data  Job Embeddings (pgvector)
       │              │
       └──────────────┘
              │
              ▼
       Match Result (Weighted Components + Penalty)
              │
              ▼
       Grounded Explanation & Skill Gap Matrix
```

### Key Matching Capabilities
- **Job Description Analysis (`POST /analyze-job`)**: AI service parses roles, seniority, responsibilities, experience bounds, and separates **Required** vs **Preferred** skills with zero invention.
- **Local Dense Embeddings**: Generates 384-dimensional dense vectors using `sentence-transformers/all-MiniLM-L6-v2` via `fastembed` locally on CPU.
- **PostgreSQL + pgvector**: Stores normalized vectors in `candidate_embeddings` and `job_embeddings` with SHA-256 content hashing to avoid redundant computation.
- **Skill Normalization & Source Tracking**: Normalizes technology aliases (e.g. `NodeJS` -> `Node.js`, `postgres` -> `PostgreSQL`, `k8s` -> `Kubernetes`) and aggregates candidate skills across `skills`, `experience`, `projects`, and `certifications` without mutating verified profiles.
- **Configurable Multi-Factor Scoring**:
  - `Skill Match`: 30%
  - `Role Match`: 20%
  - `Experience Match`: 15%
  - `Semantic Match`: 15%
  - `Location Match`: 10%
  - `Preference Match`: 10%
- **Configurable Required-Skill Penalty**: Deducts points per missing required skill (`REQUIRED_SKILL_PENALTY=0.10`, capped at 40 points) to reflect mandatory prerequisites without binary drop-offs.
- **Strict Anti-Hallucination**: Semantic similarity never fabricates skills. Missing required skills are explicitly called out in the Skill Gap Matrix.
- **Batch Recalculation & Sorting**: Supports batch evaluation across all jobs (`POST /api/matches/recalculate`) and sorting in the job board (`GET /api/jobs?sortBy=match`).

### Matching Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/jobs/:id/analyze` | Run or retrieve cached structured AI job analysis |
| `GET` | `/api/jobs/:id/analysis` | Get structured job requirements, experience range, and skills |
| `POST` | `/api/jobs/:id/match` | Compute comprehensive multi-factor match against candidate profile |
| `GET` | `/api/jobs/:id/match` | Retrieve cached match analysis and skill gaps for a job |
| `POST` | `/api/matches/recalculate` | Batch recalculate matches for candidate against all active jobs |
| `GET` | `/api/matches` | List match results ordered by score |
| `GET` | `/api/matches/:id` | Get individual match result by ID |

---

## Step 3: Job Collection Features

### Connector Architecture & Source Registry
- **Connector Interface (`IJobSourceConnector`)**: Standardized contract with capabilities (`search`, `jobDetails`, `api`, `publicFeed`, `automatedCollection`).
- **Source Registry (`JobSourceRegistry`)**: Discovers connectors and evaluates database enablement and restrictions.
- **Mock Provider (`MockJobSource`)**: Realistic offline test jobs across diverse locations, salaries, remote styles, and deliberate duplicate test records.
- **Real Provider (`ArbeitnowJobSource`)**: Legitimate public API integration (`https://www.arbeitnow.com/api/job-board-api`) requiring zero scraping or anti-bot bypass.
- **Source Policy Compliance**: Non-permitted platforms are marked with `automated_collection_allowed = false`. No stealth scraping, CAPTCHAs, or authentication bypasses are implemented.

### Normalization & Deduplication
- **Job Normalizer**: Maps arbitrary source strings into standardized enums (`full_time`, `part_time`, `contract`, `internship`; `remote`, `hybrid`, `onsite`), normalizes currencies/salaries without hallucination.
- **Deduplication Engine**:
  - *Level 1*: Strict uniqueness on `(source_id, source_job_id)`.
  - *Level 2*: Cross-source conservative matching on normalized company, normalized title, and location/remote compatibility.

### Job Collection Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/jobs` | Search & filter jobs with parameterized SQL pagination |
| `GET` | `/api/jobs/:id` | Get single canonical job details & raw source payload |
| `POST` | `/api/jobs/sync` | Trigger collection sync across enabled connectors (isolated error handling) |
| `GET` | `/api/job-sources` | List all registered job sources and capabilities |
| `GET` | `/api/job-sources/:id` | Get details for an individual job source |
| `GET` | `/api/job-sources/:id/syncs` | View sync execution audit history for a source |

---

## Step 2: Resume + Candidate Profile Features

### Supported Formats
- **PDF** (`.pdf`, extracted via PyMuPDF)
- **DOCX** (`.docx`, extracted via python-docx)
- Strict validation rejects unsupported extensions or MIME types with HTTP 400.
- Maximum file size configurable via `MAX_RESUME_SIZE_MB=10`.
- Safe local storage in `./storage/resumes` with randomized UUID file naming (path-traversal safe).

### Candidate Profile Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/resumes` | Upload resume file (`resume` multipart field) and auto-extract/parse |
| `GET` | `/api/resumes` | List all uploaded resumes for candidate |
| `GET` | `/api/resumes/versions` | List candidate profile version history |
| `GET` | `/api/resumes/:id` | Get individual resume metadata |
| `DELETE` | `/api/resumes/:id` | Delete resume record and associated file |
| `POST` | `/api/resumes/:id/process` | Re-run extraction and AI parsing for an existing resume |
| `GET` | `/api/profile` | Retrieve the current candidate profile |
| `PUT` | `/api/profile` | Update and verify candidate profile (`verificationStatus: verified`) |
| `GET` | `/api/profile/preferences` | Retrieve job search preferences |
| `PUT` | `/api/profile/preferences` | Update job search preferences |

### AI Microservice Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `http://localhost:8000/extract-text` | Extract plain text from PDF or DOCX file stream |
| `POST` | `http://localhost:8000/parse-resume` | Convert resume text to validated JSON schema without hallucinating |

---

## 1. Requirements

- **Docker**: Engine version 24.0+ (or Rootless Docker)
- **Docker Compose**: version 2.20+
- *(Optional for standalone local development without containers)*:
  - **Node.js**: v20+ or v22 LTS & npm 10+
  - **Python**: 3.11+

---

## 2. Quick Start (Docker Compose)

### 1. Copy Environment Configuration
```bash
cp .env.example .env
```

Review `.env` and configure any custom port mappings or credentials if desired.

### 2. Start the Complete Stack
Build and launch all services in detached mode:
```bash
docker compose up -d --build
```

### 3. Verify Container Status
Check that all 6 services are up and healthy:
```bash
docker compose ps
```

### 4. Open the Web Application
Open your browser and navigate to:
```text
http://localhost:3000
```
Click **Check Health** to verify real-time status of all backend services, database, cache, and AI engine.

---

### Job Collection & Search Testing
```bash
# 1. Trigger job collection sync across enabled sources
curl -i -X POST http://localhost:4000/api/jobs/sync

# 2. Trigger sync for a specific source (e.g. mock or arbeitnow)
curl -i -X POST "http://localhost:4000/api/jobs/sync?sourceId=mock"

# 3. Search jobs by keyword
curl -s "http://localhost:4000/api/jobs?q=Backend" | jq

# 4. Filter by remote work style and location
curl -s "http://localhost:4000/api/jobs?remoteType=remote&limit=5" | jq

# 5. Retrieve full details of a specific job
curl -s "http://localhost:4000/api/jobs/<job-id>" | jq

# 6. View source sync history
curl -s "http://localhost:4000/api/job-sources/mock/syncs" | jq

# 7. Run automated verification suite
npx tsx scratch/verify_step3.ts
```

### Resume Upload Testing
```bash
# Upload a PDF resume
curl -i -X POST -F "resume=@scratch/test_resume.pdf" http://localhost:4000/api/resumes

# Upload a DOCX resume
curl -i -X POST -F "resume=@scratch/test_resume.docx" http://localhost:4000/api/resumes

# Retrieve current profile
curl -s http://localhost:4000/api/profile | jq

# Verify and update profile
curl -i -X PUT http://localhost:4000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"basics":{"name":"Verified User"},"skills":["Python","Docker"]}'

# View immutable version history
curl -s http://localhost:4000/api/resumes/versions | jq

# Run the automated verification test suite
npx tsx scratch/verify_step2.ts
```

---

## 3. Health Check Endpoints

| Service | Method | Endpoint | Description |
|---|---|---|---|
| **API Gateway** | `GET` | `http://localhost:4000/health` | API Gateway status (`{"status":"ok","service":"api"}`) |
| **PostgreSQL** | `GET` | `http://localhost:4000/health/db` | Database connection ping (`SELECT 1;`) |
| **Redis** | `GET` | `http://localhost:4000/health/redis` | In-memory cache ping (`PING`) |
| **AI Service (Proxy)** | `GET` | `http://localhost:4000/health/ai` | Express proxy call to FastAPI health check |
| **Combined Status** | `GET` | `http://localhost:4000/health/all` | Aggregated health check for frontend dashboard |
| **FastAPI Microservice** | `GET` | `http://localhost:8000/health` | Direct AI microservice health check |
| **FastAPI Test** | `GET` | `http://localhost:8000/test` | AI microservice test route (`{"message":"AI service is working"}`) |
| **Ollama Health** | `GET` | `http://localhost:8000/health/ollama` | Ollama connectivity check via FastAPI |

---

## 4. Ollama LLM Usage

Ollama runs as a dedicated container (`ai-job-hunter-ollama`) on port 11434.

To download an LLM model (e.g. `llama3.2` or `mistral`) without downloading large files on every container rebuild:
```bash
docker exec -it ai-job-hunter-ollama ollama pull llama3.2
```

To list downloaded models:
```bash
docker exec -it ai-job-hunter-ollama ollama list
```

---

## 5. Development Commands

### Docker Compose
```bash
# Start all containers in foreground
docker compose up

# Build and start in background
docker compose up -d --build

# View aggregated logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f api
docker compose logs -f ai
docker compose logs -f web

# Stop all containers
docker compose down

# Stop and wipe volumes
docker compose down -v
```

### Running Services Standalone (Local Development)

#### 1. Start Infrastructure Only
```bash
docker compose up -d postgres redis ollama
```

#### 2. Install Monorepo Node Dependencies
```bash
npm install
```

#### 3. Run Express Backend
```bash
npm run dev --workspace=@ai-job-hunter/api
```

#### 4. Run Next.js Frontend
```bash
npm run dev --workspace=@ai-job-hunter/web
```

#### 5. Run FastAPI AI Microservice
```bash
cd services/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## 6. Troubleshooting

### Port Conflicts
- **Port 5432 in use**: An existing PostgreSQL server is running locally. Stop it (`sudo systemctl stop postgresql`) or change `POSTGRES_PORT=5433` in `.env`.
- **Port 6379 in use**: An existing Redis server is running. Change `REDIS_PORT=6380` in `.env`.
- **Port 3000 / 4000 / 8000 in use**: Adjust `WEB_PORT`, `API_PORT`, or `AI_PORT` in `.env`.

### PostgreSQL Not Starting
- Check logs: `docker compose logs postgres`
- Verify database credentials in `.env` match `DATABASE_URL`.

### Redis Unavailable
- Check logs: `docker compose logs redis`
- Test ping directly: `docker exec -it ai-job-hunter-redis redis-cli ping`

### AI Service Unavailable
- Check logs: `docker compose logs ai`
- Ensure FastAPI dependencies installed cleanly and uvicorn is listening on `0.0.0.0:8000`.

### Container Permission Issues (Rootless Docker)
- If using Rootless Docker, ensure `DOCKER_HOST="unix:///run/user/1000/docker.sock"` is set in your shell environment.
