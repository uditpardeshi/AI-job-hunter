from typing import Optional
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    service: str
    ollama_connected: Optional[bool] = None

class TestResponse(BaseModel):
    message: str

class JobAnalysisData(BaseModel):
    role: str
    seniority: Optional[str] = None
    requiredSkills: list[str] = []
    preferredSkills: list[str] = []
    responsibilities: list[str] = []
    educationRequirements: list[str] = []
    experienceMin: Optional[int] = None
    experienceMax: Optional[int] = None
    remoteType: Optional[str] = None

class JobAnalysisRequest(BaseModel):
    title: str
    description: str
    model_name: Optional[str] = None

class JobAnalysisResponse(BaseModel):
    success: bool
    data: JobAnalysisData
    model_used: str
    message: Optional[str] = None

class EmbeddingsRequest(BaseModel):
    texts: list[str]
    model_name: Optional[str] = None

class EmbeddingsResponse(BaseModel):
    success: bool
    model_name: str
    dimension: int
    embeddings: list[list[float]]

class EmailClassifyRequest(BaseModel):
    subject: str
    sender: str
    body: Optional[str] = None
    snippet: Optional[str] = None

class EmailClassifyResponse(BaseModel):
    success: bool
    category: str
    confidence: float
    jobTitle: Optional[str] = None
    company: Optional[str] = None
    suggestedStatus: Optional[str] = None
    requiresResponse: bool = False
    summary: Optional[str] = None

class EmailGenerateRequest(BaseModel):
    candidateProfile: Optional[dict] = None
    jobTitle: Optional[str] = None
    company: Optional[str] = None
    purpose: str = 'APPLICATION_FOLLOW_UP'
    tone: str = 'professional'
    emailContext: Optional[str] = None
    userInstructions: Optional[str] = None

class EmailGenerateResponse(BaseModel):
    success: bool
    subject: str
    body: str
    purpose: str
    warnings: list[str] = []
