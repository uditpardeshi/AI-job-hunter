from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    EmailClassifyRequest,
    EmailClassifyResponse,
    EmailGenerateRequest,
    EmailGenerateResponse,
)
from app.services.email_service import email_service

router = APIRouter()

@router.post("/classify-email", response_model=EmailClassifyResponse)
async def classify_email_endpoint(req: EmailClassifyRequest):
    try:
        res = await email_service.classify_email(
            subject=req.subject,
            sender=req.sender,
            body=req.body,
            snippet=req.snippet,
        )
        return EmailClassifyResponse(
            success=True,
            category=res.get("category", "OTHER"),
            confidence=res.get("confidence", 0.8),
            jobTitle=res.get("jobTitle"),
            company=res.get("company"),
            suggestedStatus=res.get("suggestedStatus"),
            requiresResponse=res.get("requiresResponse", False),
            summary=res.get("summary"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email classification failed: {str(e)}")

@router.post("/generate-email", response_model=EmailGenerateResponse)
async def generate_email_endpoint(req: EmailGenerateRequest):
    try:
        res = await email_service.generate_email(
            candidate_profile=req.candidateProfile,
            job_title=req.jobTitle,
            company=req.company,
            purpose=req.purpose,
            tone=req.tone,
            email_context=req.emailContext,
            user_instructions=req.userInstructions,
        )
        return EmailGenerateResponse(
            success=True,
            subject=res.get("subject", "Regarding Application"),
            body=res.get("body", ""),
            purpose=req.purpose,
            warnings=res.get("warnings", []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email generation failed: {str(e)}")
