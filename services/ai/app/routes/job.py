import logging
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import JobAnalysisRequest, JobAnalysisResponse, JobAnalysisData
from app.services.job_analyzer import job_analyzer, JobAnalyzerError

logger = logging.getLogger("ai-service.routes.job")

router = APIRouter(tags=["Job Analysis"])

@router.post("/analyze-job", response_model=JobAnalysisResponse)
async def analyze_job_endpoint(payload: JobAnalysisRequest):
    """Analyze a job posting description and return structured requirements, skills, and constraints."""
    try:
        data, model_used = await job_analyzer.analyze(
            title=payload.title,
            description=payload.description,
            requested_model=payload.model_name
        )
        return JobAnalysisResponse(
            success=True,
            data=data,
            model_used=model_used,
            message="Job analyzed successfully"
        )
    except JobAnalyzerError as e:
        logger.warning(f"Job analyzer client error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error during job analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Job analysis failed: {str(e)}"
        )
