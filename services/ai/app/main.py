import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.routes.health import router as health_router
from app.routes.resume import router as resume_router
from app.routes.job import router as job_router
from app.routes.embeddings import router as embeddings_router
from app.routes.tailor import router as tailor_router
from app.routes.email import router as email_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="AI Job Hunter - AI Service",
    description="FastAPI microservice for AI Job Hunter orchestration and LLM integrations",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(resume_router)
app.include_router(job_router)
app.include_router(embeddings_router)
app.include_router(tailor_router)
app.include_router(email_router)

@app.on_event("startup")
async def startup_event():
    logger.info(f"AI Service started in {settings.environment} mode on port {settings.port}")
    logger.info(f"Ollama configured at {settings.ollama_base_url}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
