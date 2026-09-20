import json
import re
import logging
from typing import Optional, Dict, Any, Tuple, List
import httpx
from app.config.settings import settings
from app.models.candidate import CandidateProfileSchema, CandidateBasics
from app.prompts.resume_parser import RESUME_PARSER_SYSTEM_PROMPT, build_resume_prompt

logger = logging.getLogger("ai-service.parser")

class ParserError(Exception):
    pass

class ResumeParser:
    def __init__(self, ollama_url: str = settings.ollama_base_url):
        self.ollama_url = ollama_url.rstrip("/")

    async def get_available_model(self) -> Optional[str]:
        """Query Ollama for available models, selecting an appropriate one if available."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.ollama_url}/api/tags")
                if res.status_code == 200:
                    models = res.json().get("models", [])
                    if models:
                        # Prefer llama3.2, mistral, llama3, qwen, etc.
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
        # Strip ```json ... ```
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()
            else:
                cleaned = re.sub(r"```(?:json)?|```", "", cleaned).strip()

        # Find first '{' and last '}'
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

        # Try removing trailing commas before } or ]
        repaired = re.sub(r",\s*([}\]])", r"\1", cleaned)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        # Try replacing single quotes with double quotes
        repaired = re.sub(r"(?<!\\)'", '"', repaired)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        return None

    def heuristic_extraction(self, text: str) -> CandidateProfileSchema:
        """Factual pattern extraction fallback when Ollama has no model downloaded.
        Extracts only explicit patterns (email, phone, github, linkedin, skills) and never invents.
        """
        basics = CandidateBasics()

        # Email
        email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        if email_match:
            basics.email = email_match.group(0)

        # Phone
        phone_match = re.search(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
        if phone_match:
            basics.phone = phone_match.group(0).strip()

        # LinkedIn
        linkedin_match = re.search(r"(https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+)", text, re.I)
        if linkedin_match:
            basics.linkedin = linkedin_match.group(1)

        # GitHub
        github_match = re.search(r"(https?://(?:www\.)?github\.com/[a-zA-Z0-9_-]+)", text, re.I)
        if github_match:
            basics.github = github_match.group(1)

        # First non-empty line as name if reasonable length
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if lines:
            first_line = lines[0]
            if len(first_line) < 40 and not any(char in first_line for char in "@/:{}[]"):
                basics.name = first_line

        # Known common tech skills explicitly mentioned in text
        known_skills = [
            "Python", "JavaScript", "TypeScript", "Node.js", "React", "Next.js", "Express",
            "FastAPI", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes",
            "AWS", "GCP", "Git", "Linux", "GraphQL", "Tailwind CSS", "HTML", "CSS", "C++", "Java", "Go"
        ]
        found_skills = []
        for skill in known_skills:
            if re.search(r"\b" + re.escape(skill) + r"\b", text, re.I):
                found_skills.append(skill)

        return CandidateProfileSchema(
            basics=basics,
            skills=found_skills,
            experience=[],
            education=[],
            projects=[],
            certifications=[],
            achievements=[]
        )

    async def parse_with_ollama(self, text: str, model_name: Optional[str] = None) -> Tuple[CandidateProfileSchema, str]:
        """Send resume text to Ollama and parse structured response."""
        chosen_model = model_name or await self.get_available_model() or "llama3.2"
        prompt = build_resume_prompt(text)

        payload = {
            "model": chosen_model,
            "prompt": prompt,
            "system": RESUME_PARSER_SYSTEM_PROMPT,
            "stream": False,
            "options": {
                "temperature": 0.1,  # Low temperature for strict factual determinism
            },
            "format": "json"  # Ollama JSON mode
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(f"{self.ollama_url}/api/generate", json=payload)
                if res.status_code == 200:
                    raw_response = res.json().get("response", "")
                    parsed_dict = self.repair_json(raw_response)
                    if parsed_dict:
                        profile = CandidateProfileSchema.model_validate(parsed_dict)
                        return profile, chosen_model
                    else:
                        logger.warning(f"Ollama returned unparseable JSON: {raw_response[:200]}")
                else:
                    logger.warning(f"Ollama returned HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.warning(f"Ollama parsing call failed: {e}")

        # Fallback to factual heuristic extraction
        logger.info("Using factual fallback extractor...")
        profile = self.heuristic_extraction(text)
        return profile, "heuristic-fallback"

    async def parse_resume(self, text: str, requested_model: Optional[str] = None) -> Tuple[CandidateProfileSchema, str, List[str]]:
        if not text or not text.strip():
            raise ParserError("No resume text provided for parsing.")

        profile, model_used = await self.parse_with_ollama(text, requested_model)

        # Detect fields that are empty or missing
        unsupported_fields = []
        if not profile.basics.email:
            unsupported_fields.append("basics.email")
        if not profile.basics.phone:
            unsupported_fields.append("basics.phone")
        if not profile.experience:
            unsupported_fields.append("experience")
        if not profile.education:
            unsupported_fields.append("education")
        if not profile.skills:
            unsupported_fields.append("skills")

        return profile, model_used, unsupported_fields

resume_parser = ResumeParser()
