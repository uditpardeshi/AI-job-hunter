import { config } from '../config';
import { logger } from '../utils/logger';

export interface AiServiceHealth {
  status: 'ok' | 'error';
  service: string;
  data?: unknown;
  error?: string;
}

export async function checkAiHealth(): Promise<AiServiceHealth> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/health`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        status: 'ok',
        service: 'ai',
        data,
      };
    } else {
      return {
        status: 'error',
        service: 'ai',
        error: `AI service returned HTTP ${response.status}`,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown AI service error';
    logger.error(`AI service connection failed at ${targetUrl}:`, errorMsg);
    return {
      status: 'error',
      service: 'ai',
      error: errorMsg,
    };
  }
}

export interface AnalyzeJobAiResult {
  role: string;
  seniority: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  educationRequirements: string[];
  experienceMin: number | null;
  experienceMax: number | null;
  remoteType: string | null;
  modelUsed: string;
}

export async function analyzeJobWithAi(
  title: string,
  description: string,
  modelName?: string
): Promise<AnalyzeJobAiResult> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/analyze-job`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, model_name: modelName }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI job analysis failed with status ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return {
    ...result.data,
    modelUsed: result.model_used || 'ai-service',
  };
}

export async function generateEmbeddingsWithAi(
  texts: string[],
  modelName?: string
): Promise<{ modelName: string; dimension: number; embeddings: number[][] }> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/embeddings/generate`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, model_name: modelName }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding generation failed with status ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return {
    modelName: result.model_name,
    dimension: result.dimension,
    embeddings: result.embeddings,
  };
}

export async function tailorResumeWithAi(payload: {
  candidateProfile: any;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  requiredSkills: string[];
  preferredSkills: string[];
  userInstructions?: string;
  modelName?: string;
}): Promise<{ data: any; modelUsed: string }> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/tailor-resume`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI resume tailoring failed with status ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return {
    data: result.data,
    modelUsed: result.model_used || 'ai-service',
  };
}

export async function generateCoverLetterWithAi(payload: {
  candidateProfile: any;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  tone?: string;
  userInstructions?: string;
  modelName?: string;
}): Promise<{ data: any; modelUsed: string }> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/generate-cover-letter`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI cover letter generation failed with status ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return {
    data: result.data,
    modelUsed: result.model_used || 'ai-service',
  };
}

export async function exportDocumentWithAi(
  endpoint: 'export/pdf' | 'export/docx' | 'export/cover-letter/pdf' | 'export/cover-letter/docx',
  payload: any
): Promise<Buffer> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/${endpoint}`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Document export failed with status ${response.status}: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function classifyEmailWithAi(payload: {
  subject: string;
  sender: string;
  body?: string;
  snippet?: string;
}): Promise<{
  category: string;
  confidence: number;
  jobTitle?: string | null;
  company?: string | null;
  suggestedStatus?: string | null;
  requiresResponse: boolean;
  summary?: string | null;
}> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/classify-email`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email classification failed with status ${response.status}: ${errorText}`);
  }

  return await response.json();
}

export async function generateEmailWithAi(payload: {
  candidateProfile?: any;
  jobTitle?: string | null;
  company?: string | null;
  purpose: string;
  tone: string;
  emailContext?: string | null;
  userInstructions?: string | null;
}): Promise<{
  subject: string;
  body: string;
  purpose: string;
  warnings: string[];
}> {
  const targetUrl = `${config.aiServiceUrl.replace(/\/$/, '')}/generate-email`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email generation failed with status ${response.status}: ${errorText}`);
  }

  return await response.json();
}
