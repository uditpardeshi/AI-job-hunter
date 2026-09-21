import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, status, Response
from pydantic import BaseModel
from app.services.tailor_service import tailor_service
from app.services.document_exporter import document_exporter

logger = logging.getLogger("ai-service.routes.tailor")

router = APIRouter(tags=["Resume Tailoring & Cover Letters"])

class TailorResumeRequest(BaseModel):
    candidateProfile: Dict[str, Any]
    jobTitle: str
    jobCompany: str
    jobDescription: str
    requiredSkills: List[str] = []
    preferredSkills: List[str] = []
    userInstructions: Optional[str] = ""
    modelName: Optional[str] = None

class CoverLetterRequest(BaseModel):
    candidateProfile: Dict[str, Any]
    jobTitle: str
    jobCompany: str
    jobDescription: str
    tone: Optional[str] = "professional"
    userInstructions: Optional[str] = ""
    modelName: Optional[str] = None

class ExportResumeRequest(BaseModel):
    resumeData: Dict[str, Any]

class ExportCoverLetterRequest(BaseModel):
    title: str
    content: str
    candidateName: Optional[str] = ""

@router.post("/tailor-resume")
async def tailor_resume_endpoint(payload: TailorResumeRequest):
    """Generate a job-tailored resume draft grounded strictly in verified candidate facts."""
    try:
        data, model_used = await tailor_service.tailor_resume(
            candidate_profile=payload.candidateProfile,
            job_title=payload.jobTitle,
            job_company=payload.jobCompany,
            job_description=payload.jobDescription,
            required_skills=payload.requiredSkills,
            preferred_skills=payload.preferredSkills,
            user_instructions=payload.userInstructions or "",
            model_name=payload.modelName
        )
        return {
            "success": True,
            "data": data,
            "model_used": model_used,
            "message": "Resume tailored successfully"
        }
    except Exception as e:
        logger.error(f"Failed to tailor resume: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resume tailoring failed: {str(e)}"
        )

@router.post("/generate-cover-letter")
async def generate_cover_letter_endpoint(payload: CoverLetterRequest):
    """Generate a targeted, non-generic cover letter for a specific role."""
    try:
        data, model_used = await tailor_service.generate_cover_letter(
            candidate_profile=payload.candidateProfile,
            job_title=payload.jobTitle,
            job_company=payload.jobCompany,
            job_description=payload.jobDescription,
            tone=payload.tone or "professional",
            user_instructions=payload.userInstructions or "",
            model_name=payload.modelName
        )
        return {
            "success": True,
            "data": data,
            "model_used": model_used,
            "message": "Cover letter generated successfully"
        }
    except Exception as e:
        logger.error(f"Failed to generate cover letter: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cover letter generation failed: {str(e)}"
        )

@router.post("/export/pdf")
async def export_pdf_endpoint(payload: ExportResumeRequest):
    """Export tailored resume as high quality vector PDF."""
    try:
        pdf_bytes = document_exporter.export_resume_pdf(payload.resumeData)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=tailored_resume.pdf"}
        )
    except Exception as e:
        logger.error(f"Failed to export resume PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export/docx")
async def export_docx_endpoint(payload: ExportResumeRequest):
    """Export tailored resume as formatted Word DOCX."""
    try:
        docx_bytes = document_exporter.export_resume_docx(payload.resumeData)
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": "attachment; filename=tailored_resume.docx"}
        )
    except Exception as e:
        logger.error(f"Failed to export resume DOCX: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export/cover-letter/pdf")
async def export_cover_letter_pdf_endpoint(payload: ExportCoverLetterRequest):
    try:
        pdf_bytes = document_exporter.export_cover_letter_pdf(
            title=payload.title,
            content=payload.content,
            candidate_name=payload.candidateName or ""
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=cover_letter.pdf"}
        )
    except Exception as e:
        logger.error(f"Failed to export cover letter PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export/cover-letter/docx")
async def export_cover_letter_docx_endpoint(payload: ExportCoverLetterRequest):
    try:
        docx_bytes = document_exporter.export_cover_letter_docx(
            title=payload.title,
            content=payload.content,
            candidate_name=payload.candidateName or ""
        )
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": "attachment; filename=cover_letter.docx"}
        )
    except Exception as e:
        logger.error(f"Failed to export cover letter DOCX: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
