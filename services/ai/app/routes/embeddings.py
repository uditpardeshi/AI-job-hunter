import logging
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import EmbeddingsRequest, EmbeddingsResponse
from app.services.embeddings import embedding_service, DEFAULT_MODEL

logger = logging.getLogger("ai-service.routes.embeddings")

router = APIRouter(prefix="/embeddings", tags=["Embeddings"])

@router.post("/generate", response_model=EmbeddingsResponse)
async def generate_embeddings_endpoint(payload: EmbeddingsRequest):
    """Generate dense vector embeddings for provided texts."""
    if not payload.texts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one text string must be provided."
        )

    try:
        model_name = payload.model_name or DEFAULT_MODEL
        vectors = embedding_service.generate_embeddings(payload.texts, model_name=model_name)
        dimension = len(vectors[0]) if vectors else embedding_service.dimension

        return EmbeddingsResponse(
            success=True,
            model_name=model_name,
            dimension=dimension,
            embeddings=vectors
        )
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding generation failed: {str(e)}"
        )
