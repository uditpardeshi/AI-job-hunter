import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "AI Job Hunter - AI Service"
    environment: str = os.getenv("NODE_ENV", "development")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("AI_PORT", "8000"))
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
