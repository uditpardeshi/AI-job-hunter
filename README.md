# AI Job Hunter - Step 1: Foundation

AI Job Hunter is an intelligent agentic platform for discovering, evaluating, and applying to job opportunities. This repository contains the foundational microservices architecture.

## System Architecture

```text
Browser User
   ↓
apps/web (Next.js 14 + Tailwind CSS) [Port 3000]
   ├── / (System Health Dashboard)
   └── /resume (Resume Upload, Candidate Profile Review & Verification)
   ↓
apps/api (Express + TypeScript API Gateway) [Port 4000]
   ├── postgres (PostgreSQL 16) [Port 5432]
   │     └── Tables: users, resumes, candidate_profiles, resume_versions
   ├── redis (Redis 7 In-Memory Cache) [Port 6379]
   └── services/ai (FastAPI + Python AI Microservice) [Port 8000]
         ├── PyMuPDF & python-docx Text Extractors
         ├── Zero-Invention Resume Parser
         └── ollama (Local LLM Engine) [Port 11434]
```

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
