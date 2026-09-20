import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.services.extractor import resume_extractor, ExtractionError
from app.services.parser import resume_parser, ParserError
from app.models.candidate import ParseResumeRequest, ParseResumeResponse

logger = logging.getLogger("ai-service.routes.resume")
router = APIRouter()

@router.post("/extract-text")
async def extract_text_endpoint(
    file: UploadFile = File(...),
    file_type: Optional[str] = Form(None)
):
    """Extract plain structured text from an uploaded resume file (PDF or DOCX)."""
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Determine type
        determined_type = file_type
        if not determined_type and file.filename:
            determined_type = file.filename.split(".")[-1]

        if not determined_type:
            raise HTTPException(status_code=400, detail="Could not determine file type.")

        text = resume_extractor.extract_text(content, determined_type)
        return {
            "status": "ok",
            "filename": file.filename,
            "text": text,
            "char_count": len(text),
            "word_count": len(text.split())
        }
    except ExtractionError as e:
        logger.error(f"Text extraction error: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in /extract-text: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during text extraction.")

@router.post("/parse-resume", response_model=ParseResumeResponse)
async def parse_resume_endpoint(payload: ParseResumeRequest):
    """Convert raw resume text into a structured candidate profile schema."""
    try:
        profile, model_used, unsupported = await resume_parser.parse_resume(
            text=payload.text,
            requested_model=payload.model
        )
        return ParseResumeResponse(
            status="ok",
            data=profile,
            unsupported_fields=unsupported,
            model_used=model_used
        )
    except ParserError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in /parse-resume: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse resume with AI service.")
