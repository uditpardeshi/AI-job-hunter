# AI Job Hunter — Setup & Quickstart Guide

Get the complete AI Job Hunter automation and career intelligence workspace running with a single command.

---

## Quickstart (One Command)

### Prerequisites:
1. **Python 3.9+** ([Download](https://www.python.org/downloads/))
2. **Docker Desktop / Docker Engine** ([Download](https://www.docker.com/products/docker-desktop/))

### Steps:
1. Clone or copy the project into a folder.
2. Open a terminal in the project directory.
3. Run:

```bash
python setup_and_run.py
```

*(On Windows, `py setup_and_run.py` or `python setup_and_run.py`)*

4. The script will automatically check your system, prepare configuration, start containers, verify all health endpoints, and open your browser to **`http://localhost:3000`**.

---

## Supported Operating Systems
- **Windows 10 / 11** (with Docker Desktop)
- **macOS** (Apple Silicon or Intel, with Docker Desktop)
- **Linux** (Ubuntu, Debian, Fedora, Arch, etc., with Docker & Docker Compose)

---

## Command Options

| Command | Description |
| :--- | :--- |
| `python setup_and_run.py` | Full standard startup & automated browser launch |
| `python setup_and_run.py --debug` | Verbose debug mode with process logs |
| `python setup_and_run.py --no-browser` | Starts application without automatically opening a browser window |

---

## Application URLs & Services

Once started, the following services are live:

- **Web Dashboard & Tracker**: [http://localhost:3000](http://localhost:3000)
- **API Gateway (Express)**: [http://localhost:4000](http://localhost:4000)
- **AI Microservice (FastAPI)**: [http://localhost:8000](http://localhost:8000)
- **PostgreSQL Database (pgvector)**: `localhost:5432` (`ai_job_hunter`)
- **Redis Cache**: `localhost:6379`

---

## AI & Model Policy

- **No Ollama models are ever downloaded or pulled.**
- The system operates out-of-the-box using high-accuracy **heuristic evaluation (`heuristic-v1`)** for matching, parsing, anti-fabrication grounding, and drafting.
- Zero extra bandwidth or heavy model storage is required.

---

## Stopping & Restarting

- **To stop the application:**
  ```bash
  docker compose down
  ```
  *(All candidate profiles, uploaded resumes, and database records are safely preserved in persistent Docker volumes).*

- **To view real-time logs:**
  ```bash
  docker compose logs -f
  ```

- **To restart:**
  ```bash
  python setup_and_run.py
  ```

---

## Troubleshooting

1. **"Docker is installed, but Docker Engine is not running":**
   - Open Docker Desktop on Windows/macOS and wait until the status displays "Engine running", or start the docker service on Linux (`sudo systemctl start docker`).
2. **"Port already in use":**
   - Check if you have an existing PostgreSQL (5432) or Next.js (3000) service running locally, or modify port variables in `.env`.
