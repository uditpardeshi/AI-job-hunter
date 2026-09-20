from fastapi import APIRouter
from app.models.schemas import HealthResponse, TestResponse
from app.services.ollama_service import ollama_service

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", service="ai")

@router.get("/test", response_model=TestResponse)
async def test():
    return TestResponse(message="AI service is working")

@router.get("/health/ollama")
async def health_ollama():
    is_connected = await ollama_service.check_health()
    return {
        "status": "ok" if is_connected else "degraded",
        "service": "ollama",
        "connected": is_connected
    }
