import json
import re
import logging
from typing import Optional, Dict, Any, Tuple, List
import httpx
from app.config.settings import settings
from app.prompts.resume_tailoring import RESUME_TAILORING_SYSTEM_PROMPT, build_tailoring_prompt
from app.prompts.cover_letter import COVER_LETTER_SYSTEM_PROMPT, build_cover_letter_prompt

logger = logging.getLogger("ai-service.tailor")

class TailorService:
    def __init__(self, ollama_url: str = settings.ollama_base_url):
        self.ollama_url = ollama_url.rstrip("/")

    async def get_available_model(self) -> Optional[str]:
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

    def clean_json(self, text: str) -> str:
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
        cleaned = self.clean_json(raw_json)
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

    def heuristic_tailor(
        self,
        candidate_profile: Dict[str, Any],
        job_title: str,
        job_company: str,
        required_skills: List[str],
        preferred_skills: List[str]
    ) -> Dict[str, Any]:
        """Factual deterministic fallback that prioritizes verified candidate facts
        and reorders existing skills without fabricating missing technologies.
        """
        basics = candidate_profile.get("basics") or {}
        raw_skills = candidate_profile.get("skills") or []
        experience = candidate_profile.get("experience") or []
        projects = candidate_profile.get("projects") or []
        education = candidate_profile.get("education") or []
        certifications = candidate_profile.get("certifications") or []
        achievements = candidate_profile.get("achievements") or []

        # Find matching skills (case-insensitive)
        all_job_skills = set([s.lower() for s in required_skills + preferred_skills])
        matching_skills = []
        other_skills = []
        for s in raw_skills:
            if s.lower() in all_job_skills:
                matching_skills.append(s)
            else:
                other_skills.append(s)

        reordered_skills = matching_skills + other_skills

        # Missing skills not added
        cand_lower = set([s.lower() for s in raw_skills])
        not_added = [s for s in required_skills if s.lower() not in cand_lower]

        # Targeted summary
        orig_summary = basics.get("summary") or ""
        name = basics.get("name") or "Software Professional"
        if matching_skills:
            top_tech = ", ".join(matching_skills[:4])
            summary = f"{name} with proven background in {top_tech}. Targeted for {job_title} at {job_company} with focus on delivering robust and reliable technical solutions."
        elif orig_summary:
            summary = f"{orig_summary} Targeted for {job_title} at {job_company}."
        else:
            summary = f"Experienced professional with verified track record in software engineering. Targeted for {job_title} at {job_company}."

        # Format experience bullets
        tailored_exp = []
        for exp in experience:
            desc = exp.get("description") or []
            if isinstance(desc, str):
                bullets = [b.strip("-*• ") for b in desc.splitlines() if b.strip("-*• ")]
            elif isinstance(desc, list):
                bullets = [str(b).strip("-*• ") for b in desc if str(b).strip("-*• ")]
            else:
                bullets = []

            if not bullets and exp.get("skills"):
                bullets = [f"Contributed to core initiatives utilizing {', '.join(exp.get('skills'))}."]

            tailored_exp.append({
                "company": exp.get("company", ""),
                "title": exp.get("title", ""),
                "location": exp.get("location") or None,
                "startDate": exp.get("startDate") or None,
                "endDate": exp.get("endDate") or None,
                "current": exp.get("current", False),
                "bullets": bullets
            })

        # Format projects
        tailored_proj = []
        for proj in projects:
            tailored_proj.append({
                "name": proj.get("name", ""),
                "description": proj.get("description", ""),
                "technologies": proj.get("technologies") or [],
                "url": proj.get("url") or None
            })

        return {
            "header": {
                "name": basics.get("name") or "",
                "email": basics.get("email") or "",
                "phone": basics.get("phone") or "",
                "location": basics.get("location") or "",
                "linkedin": basics.get("linkedin") or "",
                "github": basics.get("github") or "",
                "portfolio": basics.get("portfolio") or ""
            },
            "summary": summary,
            "skills": reordered_skills,
            "experience": tailored_exp,
            "projects": tailored_proj,
            "education": education,
            "certifications": certifications,
            "achievements": achievements,
            "tailoringChanges": {
                "emphasized": [f"Prioritized verified skills: {', '.join(matching_skills)}" if matching_skills else "Maintained verified technical skills"],
                "reordered": ["Positioned matching technical skills at the beginning of the skills section"],
                "deemphasized": ["Secondary skills placed after primary job-relevant skills"],
                "notAdded": not_added
            }
        }

    async def tailor_resume(
        self,
        candidate_profile: Dict[str, Any],
        job_title: str,
        job_company: str,
        job_description: str,
        required_skills: List[str],
        preferred_skills: List[str],
        user_instructions: str = "",
        model_name: Optional[str] = None
    ) -> Tuple[Dict[str, Any], str]:
        chosen_model = model_name or await self.get_available_model() or "llama3.2"
        prompt = build_tailoring_prompt(
            candidate_profile_json=json.dumps(candidate_profile, indent=2),
            job_title=job_title,
            job_company=job_company,
            job_description=job_description,
            required_skills=required_skills,
            preferred_skills=preferred_skills,
            user_instructions=user_instructions
        )

        payload = {
            "model": chosen_model,
            "prompt": prompt,
            "system": RESUME_TAILORING_SYSTEM_PROMPT,
            "stream": False,
            "options": {
                "temperature": 0.1,  # Low temperature for strict factual determinism
            },
            "format": "json"
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(f"{self.ollama_url}/api/generate", json=payload)
                if res.status_code == 200:
                    raw_resp = res.json().get("response", "")
                    parsed = self.repair_json(raw_resp)
                    if parsed and "header" in parsed and "experience" in parsed:
                        return parsed, chosen_model
                    else:
                        logger.warning(f"Ollama returned unparseable tailored resume: {raw_resp[:200]}")
        except Exception as e:
            logger.warning(f"Ollama tailoring call failed: {e}")

        logger.info("Using factual fallback for resume tailoring...")
        data = self.heuristic_tailor(
            candidate_profile=candidate_profile,
            job_title=job_title,
            job_company=job_company,
            required_skills=required_skills,
            preferred_skills=preferred_skills
        )
        return data, "heuristic-fallback"

    def heuristic_cover_letter(
        self,
        candidate_profile: Dict[str, Any],
        job_title: str,
        job_company: str,
        tone: str = "professional"
    ) -> Dict[str, Any]:
        basics = candidate_profile.get("basics") or {}
        name = basics.get("name") or "Candidate"
        skills = candidate_profile.get("skills") or []
        experience = candidate_profile.get("experience") or []

        top_skills = ", ".join(skills[:3]) if skills else "software engineering principles"

        current_role = ""
        current_company = ""
        if experience:
            current_role = experience[0].get("title", "Software Engineer")
            current_company = experience[0].get("company", "recent projects")

        greeting = f"Dear Hiring Team at {job_company},"
        p1 = f"I am reaching out regarding the {job_title} role at {job_company}. With verified engineering experience centered around {top_skills}, I am well-prepared to contribute to your technical objectives and engineering standards."

        p2 = ""
        if current_role and current_company:
            p2 = f"In my work as a {current_role} at {current_company}, I have built and maintained robust systems with a strong emphasis on reliability, clean architecture, and practical problem solving. My background has given me hands-on familiarity with the full development lifecycle."
        else:
            p2 = f"Throughout my career, I have focused on designing clean, maintainable systems and collaborating effectively across teams to deliver high-quality technical solutions."

        p3 = f"I am eager to bring my verified technical strengths to {job_company} and would welcome the opportunity to discuss how my background aligns with your current team goals. Thank you for your time and consideration."

        closing = f"Sincerely,\n{name}"
        full_content = f"{greeting}\n\n{p1}\n\n{p2}\n\n{p3}\n\n{closing}"

        return {
            "title": f"Cover Letter - {job_title} at {job_company}",
            "content": full_content,
            "tone": tone,
            "highlights": skills[:4]
        }

    async def generate_cover_letter(
        self,
        candidate_profile: Dict[str, Any],
        job_title: str,
        job_company: str,
        job_description: str,
        tone: str = "professional",
        user_instructions: str = "",
        model_name: Optional[str] = None
    ) -> Tuple[Dict[str, Any], str]:
        chosen_model = model_name or await self.get_available_model() or "llama3.2"
        prompt = build_cover_letter_prompt(
            candidate_profile_json=json.dumps(candidate_profile, indent=2),
            job_title=job_title,
            job_company=job_company,
            job_description=job_description,
            tone=tone,
            user_instructions=user_instructions
        )

        payload = {
            "model": chosen_model,
            "prompt": prompt,
            "system": COVER_LETTER_SYSTEM_PROMPT,
            "stream": False,
            "options": {
                "temperature": 0.2,
            },
            "format": "json"
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(f"{self.ollama_url}/api/generate", json=payload)
                if res.status_code == 200:
                    raw_resp = res.json().get("response", "")
                    parsed = self.repair_json(raw_resp)
                    if parsed and "content" in parsed:
                        return parsed, chosen_model
                    else:
                        logger.warning(f"Ollama returned unparseable cover letter: {raw_resp[:200]}")
        except Exception as e:
            logger.warning(f"Ollama cover letter call failed: {e}")

        logger.info("Using factual fallback for cover letter...")
        data = self.heuristic_cover_letter(
            candidate_profile=candidate_profile,
            job_title=job_title,
            job_company=job_company,
            tone=tone
        )
        return data, "heuristic-fallback"

tailor_service = TailorService()
