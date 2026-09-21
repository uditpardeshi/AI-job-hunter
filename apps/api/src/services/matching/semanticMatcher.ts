export interface SemanticMatchResult {
  semanticScore: number; // 0 - 100
  rawSimilarity: number; // -1 to 1
  explanation: string;
}

export class SemanticMatcher {
  /**
   * Compute cosine similarity between two vector embeddings.
   */
  public static computeCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
      return 0.5; // neutral fallback
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0.5;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Scale cosine similarity into an intuitive 0 - 100 score.
   */
  public static matchSemantic(candidateVec: number[], jobVec: number[]): SemanticMatchResult {
    const rawSim = this.computeCosineSimilarity(candidateVec, jobVec);

    // MiniLM embeddings for text descriptions typically hover between 0.20 (dissimilar) to 0.85+ (highly aligned)
    // Map [0.15, 0.85] smoothly to [20, 100]
    let scaled: number;
    if (rawSim <= 0.15) {
      scaled = Math.max(10, Math.round(rawSim * 100));
    } else {
      const normalized = (rawSim - 0.15) / (0.85 - 0.15);
      scaled = Math.round(20 + Math.min(1.0, Math.max(0.0, normalized)) * 80);
    }

    const clamped = Math.min(100, Math.max(0, scaled));

    return {
      semanticScore: clamped,
      rawSimilarity: Math.round(rawSim * 1000) / 1000,
      explanation:
        clamped >= 80
          ? `High contextual semantic alignment (${Math.round(rawSim * 100)}% cosine similarity) between candidate background and job requirements.`
          : clamped >= 60
          ? `Moderate contextual semantic alignment (${Math.round(rawSim * 100)}% cosine similarity).`
          : `Low contextual overlap (${Math.round(rawSim * 100)}% cosine similarity) between profile and job description.`,
    };
  }
}
