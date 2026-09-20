from typing import Optional
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    service: str
    ollama_connected: Optional[bool] = None

class TestResponse(BaseModel):
    message: str
