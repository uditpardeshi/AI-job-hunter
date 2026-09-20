import httpx
import logging
from app.config.settings import settings

logger = logging.getLogger(__name__)

class OllamaService:
    def __init__(self, base_url: str = settings.ollama_base_url):
        self.base_url = base_url.rstrip("/")

    async def check_health(self) -> bool:
        """Check if Ollama service is reachable."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Failed to reach Ollama at {self.base_url}: {e}")
            return False

ollama_service = OllamaService()
