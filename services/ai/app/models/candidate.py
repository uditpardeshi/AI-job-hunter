from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class CandidateBasics(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None

class ExperienceItem(BaseModel):
    company: str
    title: str
    location: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    current: bool = False
    description: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)

class EducationItem(BaseModel):
    institution: str
    degree: Optional[str] = None
    field: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    grade: Optional[str] = None

class ProjectItem(BaseModel):
    name: str
    description: str = ""
    url: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)

class CertificationItem(BaseModel):
    name: str
    issuer: Optional[str] = None
    date: Optional[str] = None
    url: Optional[str] = None

class CandidateProfileSchema(BaseModel):
    basics: CandidateBasics = Field(default_factory=CandidateBasics)
    skills: List[str] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    certifications: List[CertificationItem] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)

class ParseResumeRequest(BaseModel):
    text: str
    model: Optional[str] = None

class ParseResumeResponse(BaseModel):
    status: str
    data: CandidateProfileSchema
    unsupported_fields: List[str] = Field(default_factory=list)
    model_used: Optional[str] = None
