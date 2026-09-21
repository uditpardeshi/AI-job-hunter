import logging
from typing import List, Optional
from fastembed import TextEmbedding

logger = logging.getLogger("ai-service.embeddings")

DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

class EmbeddingService:
    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model_name = model_name
        self._model: Optional[TextEmbedding] = None

    def get_model(self) -> TextEmbedding:
        if self._model is None:
            logger.info(f"Loading embedding model: {self.model_name}")
            self._model = TextEmbedding(model_name=self.model_name)
        return self._model

    def generate_embeddings(self, texts: List[str], model_name: Optional[str] = None) -> List[List[float]]:
        """Generate normalized vector embeddings for a list of text strings."""
        if not texts:
            return []

        # If model_name specified and differs from current, load that model
        model = self.get_model()
        if model_name and model_name != self.model_name:
            active_model = TextEmbedding(model_name=model_name)
        else:
            active_model = model

        # FastEmbed returns an iterable of numpy arrays
        embeddings_iter = active_model.embed(texts)
        # Convert numpy arrays to standard python float lists
        result: List[List[float]] = [arr.tolist() for arr in embeddings_iter]
        return result

    @property
    def dimension(self) -> int:
        """384 for sentence-transformers/all-MiniLM-L6-v2"""
        return 384

embedding_service = EmbeddingService()
