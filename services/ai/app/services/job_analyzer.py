import json
import re
import logging
from typing import Optional, Dict, Any, Tuple, List
import httpx
from app.config.settings import settings
from app.models.schemas import JobAnalysisData
from app.prompts.job_analyzer import JOB_ANALYZER_SYSTEM_PROMPT, build_job_prompt

logger = logging.getLogger("ai-service.job-analyzer")

class JobAnalyzerError(Exception):
    pass

class JobAnalyzer:
    def __init__(self, ollama_url: str = settings.ollama_base_url):
        self.ollama_url = ollama_url.rstrip("/")

    async def get_available_model(self) -> Optional[str]:
        """Query Ollama for available models."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.ollama_url}/api/tags")
                if res.status_code == 200:
                    models = res.json().get("models", [])
                    if models:
                        names = [m.get("name", "") for m in models]
                        for pref in ["llama3.2", "llama3", "mistral", "qwen2.5", "llama"]:
                            for n in names:
                                if pref in n:
                                    return n
                        return names[0]
        except Exception as e:
            logger.warning(f"Could not fetch Ollama models: {e}")
        return None

    def clean_json_string(self, text: str) -> str:
        """Strip markdown code blocks and surrounding whitespace."""
        cleaned = text.strip()
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()
            else:
                cleaned = re.sub(r"```(?:json)?|```", "", cleaned).strip()

        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned = cleaned[start_idx : end_idx + 1]

        return cleaned

    def repair_json(self, raw_json: str) -> Optional[Dict[str, Any]]:
        """Attempt controlled repairs for common LLM JSON syntax issues."""
        cleaned = self.clean_json_string(raw_json)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        repaired = re.sub(r",\s*([}\]])", r"\1", cleaned)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        repaired = re.sub(r"(?<!\\)'", '"', repaired)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        return None

    def heuristic_extraction(self, title: str, description: str) -> JobAnalysisData:
        """Factual deterministic fallback when Ollama model is unavailable.
        Parses strictly what is explicitly in title and description without hallucinating.
        """
        full_text = f"{title}\n{description}"
        lower_text = full_text.lower()

        # 1. Seniority
        seniority: Optional[str] = None
        if re.search(r"\b(lead|principal|staff|architect)\b", title, re.I):
            seniority = "lead"
        elif re.search(r"\b(senior|sr\.?)\b", title, re.I):
            seniority = "senior"
        elif re.search(r"\b(junior|jr\.?|entry|intern|graduate)\b", title, re.I):
            seniority = "junior"
        elif re.search(r"\b(mid|intermediate)\b", title, re.I):
            seniority = "mid"

        # 2. Remote type
        remote_type: Optional[str] = None
        if re.search(r"\b(fully remote|100% remote|remote|work from home|wfh)\b", lower_text):
            remote_type = "remote"
        elif re.search(r"\b(hybrid)\b", lower_text):
            remote_type = "hybrid"
        elif re.search(r"\b(on-site|onsite|in-office)\b", lower_text):
            remote_type = "onsite"

        # 3. Experience range
        exp_min: Optional[int] = None
        exp_max: Optional[int] = None
        range_match = re.search(r"(\d+)\s*(?:-|to)\s*(\d+)\+?\s*years?(?:\s+of)?\s+experience", lower_text)
        if range_match:
            exp_min = int(range_match.group(1))
            exp_max = int(range_match.group(2))
        else:
            single_match = re.search(r"(?:at least|minimum of|minimum|\b)\s*(\d+)\+?\s*years?(?:\s+of)?\s+experience", lower_text)
            if single_match:
                exp_min = int(single_match.group(1))

        # 4. Known skills pool
        tech_skills = [
            "Node.js", "TypeScript", "JavaScript", "Python", "Go", "Golang", "Rust", "Java", "C++", "C#",
            "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra", "DynamoDB",
            "React", "Next.js", "Vue", "Angular", "Tailwind CSS", "HTML", "CSS", "GraphQL", "REST APIs",
            "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Terraform", "CI/CD", "Git", "Linux",
            "Kafka", "RabbitMQ", "FastAPI", "Express", "Django", "Flask", "Spring Boot",
            "Microservices", "Machine Learning", "Artificial Intelligence", "NLP", "Pandas", "PyTorch"
        ]

        # Partition description into required vs preferred sections if possible
        # Check if "preferred" or "nice to have" section exists
        preferred_section = ""
        required_section = description

        pref_split = re.split(r"(?:nice to have|preferred qualifications|bonus qualifications|what's a plus|preferred skills|bonus:)", description, flags=re.I)
        if len(pref_split) > 1:
            required_section = pref_split[0]
            preferred_section = " ".join(pref_split[1:])

        required_found: List[str] = []
        preferred_found: List[str] = []

        for skill in tech_skills:
            pattern = r"\b" + re.escape(skill) + r"\b"
            if re.search(pattern, preferred_section, re.I):
                preferred_found.append(skill)
            elif re.search(pattern, required_section, re.I):
                required_found.append(skill)
            elif re.search(pattern, title, re.I):
                required_found.append(skill)

        # 5. Extract bullet point responsibilities
        responsibilities: List[str] = []
        lines = [l.strip("-*• \t") for l in description.splitlines() if l.strip("-*• \t")]
        for l in lines:
            if len(l) > 20 and len(l) < 200 and any(w in l.lower() for w in ["build", "design", "develop", "maintain", "create", "collaborate", "lead", "implement"]):
                responsibilities.append(l)
            if len(responsibilities) >= 6:
                break

        return JobAnalysisData(
            role=title.strip(),
            seniority=seniority,
            requiredSkills=required_found,
            preferredSkills=preferred_found,
            responsibilities=responsibilities,
            educationRequirements=[],
            experienceMin=exp_min,
            experienceMax=exp_max,
            remoteType=remote_type
        )

    async def analyze_with_ollama(self, title: str, description: str, model_name: Optional[str] = None) -> Tuple[JobAnalysisData, str]:
        """Send job details to Ollama for structured analysis."""
        chosen_model = model_name or await self.get_available_model()
        if not chosen_model:
            logger.info("No Ollama model available; using factual fallback extractor directly.")
            data = self.heuristic_extraction(title, description)
            return data, "heuristic-fallback"

        prompt = build_job_prompt(title, description)

        payload = {
            "model": chosen_model,
            "prompt": prompt,
            "system": JOB_ANALYZER_SYSTEM_PROMPT,
            "stream": False,
            "options": {
                "temperature": 0.1,  # Strict determinism
            },
            "format": "json"
        }

        try:
            async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
                res = await client.post(f"{self.ollama_url}/api/generate", json=payload)
                if res.status_code == 200:
                    raw_response = res.json().get("response", "")
                    parsed_dict = self.repair_json(raw_response)
                    if parsed_dict:
                        data = JobAnalysisData.model_validate(parsed_dict)
                        # Ensure role defaults to title if empty
                        if not data.role:
                            data.role = title.strip()
                        return data, chosen_model
                    else:
                        logger.warning(f"Ollama returned unparseable JSON: {raw_response[:200]}")
                else:
                    logger.warning(f"Ollama returned HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.warning(f"Ollama job analysis call failed: {e}")

        logger.info("Using factual fallback extractor for job analysis...")
        data = self.heuristic_extraction(title, description)
        return data, "heuristic-fallback"

    async def analyze(self, title: str, description: str, requested_model: Optional[str] = None) -> Tuple[JobAnalysisData, str]:
        if not title or not title.strip():
            raise JobAnalyzerError("Job title is required for analysis.")
        if not description or not description.strip():
            raise JobAnalyzerError("Job description is required for analysis.")

        return await self.analyze_with_ollama(title, description, requested_model)

job_analyzer = JobAnalyzer()
