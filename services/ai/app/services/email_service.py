import json
import re
import logging
from typing import Optional, Dict, Any, List
import httpx
from app.config.settings import settings
from app.prompts.email_prompts import (
    EMAIL_CLASSIFICATION_SYSTEM_PROMPT,
    EMAIL_GENERATION_SYSTEM_PROMPT,
)

logger = logging.getLogger("ai-service.email")

class EmailService:
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
        except Exception:
            return None

    # ----------------------------------------------------
    # 1. Email Classification
    # ----------------------------------------------------

    async def classify_email(
        self,
        subject: str,
        sender: str,
        body: Optional[str] = None,
        snippet: Optional[str] = None,
    ) -> Dict[str, Any]:
        combined_text = f"Subject: {subject}\nFrom: {sender}\nSnippet: {snippet or ''}\n\nBody:\n{body or snippet or ''}"
        
        user_prompt = f"""Please classify the following email:
<EMAIL_CONTENT>
{combined_text[:3000]}
</EMAIL_CONTENT>
"""
        model = await self.get_available_model()
        if model:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        f"{self.ollama_url}/api/generate",
                        json={
                            "model": model,
                            "system": EMAIL_CLASSIFICATION_SYSTEM_PROMPT,
                            "prompt": user_prompt,
                            "stream": False,
                            "options": {"temperature": 0.0},
                        },
                    )
                    if resp.status_code == 200:
                        raw = resp.json().get("response", "")
                        parsed = self.repair_json(raw)
                        if parsed and "category" in parsed:
                            return {
                                "category": parsed.get("category", "OTHER"),
                                "confidence": float(parsed.get("confidence", 0.9)),
                                "jobTitle": parsed.get("jobTitle"),
                                "company": parsed.get("company"),
                                "suggestedStatus": parsed.get("suggestedStatus"),
                                "requiresResponse": bool(parsed.get("requiresResponse", False)),
                                "summary": parsed.get("summary", ""),
                            }
            except Exception as e:
                logger.warning(f"Ollama classification failed: {e}. Using deterministic heuristic.")

        # Deterministic Heuristic Fallback
        return self._heuristic_classify(subject, sender, body or snippet or "")

    def _heuristic_classify(self, subject: str, sender: str, content: str) -> Dict[str, Any]:
        text = f"{subject} {content}".lower()
        sender_lower = sender.lower()

        # Company extraction heuristic
        company = None
        comp_match = re.search(r"@([a-zA-Z0-9-]+)\.", sender_lower)
        if comp_match:
            domain_part = comp_match.group(1)
            if domain_part not in ["gmail", "yahoo", "outlook", "hotmail", "icloud", "proton"]:
                company = domain_part.capitalize()

        # Job title heuristic
        job_title = None
        title_patterns = [
            r"(backend engineer|frontend engineer|full stack engineer|software engineer|lead developer|architect)",
            r"(senior [a-z\s]+ engineer)",
            r"(engineering manager|product manager)",
        ]
        for p in title_patterns:
            m = re.search(p, text)
            if m:
                job_title = m.group(1).title()
                break

        # Category rules
        if any(w in text for w in ["interview", "technical screen", "schedule a call", "schedule an interview", "phone screen", "technical conversation", "speaking with", "invite you"]):
            return {
                "category": "INTERVIEW_INVITATION",
                "confidence": 0.95,
                "jobTitle": job_title,
                "company": company,
                "suggestedStatus": "INTERVIEW",
                "requiresResponse": True,
                "summary": f"Invitation to interview for {job_title or 'position'} at {company or 'company'}",
            }

        if any(w in text for w in ["offer of employment", "pleased to offer", "formal offer", "job offer", "compensation package"]):
            return {
                "category": "OFFER",
                "confidence": 0.96,
                "jobTitle": job_title,
                "company": company,
                "suggestedStatus": "OFFER",
                "requiresResponse": True,
                "summary": f"Job offer received from {company or 'company'}",
            }

        if any(w in text for w in ["not moving forward", "other candidates", "regret to inform", "unsuccessful", "decided not to proceed"]):
            return {
                "category": "REJECTION",
                "confidence": 0.95,
                "jobTitle": job_title,
                "company": company,
                "suggestedStatus": "REJECTED",
                "requiresResponse": False,
                "summary": f"Application rejection from {company or 'company'}",
            }

        if any(w in text for w in ["assessment", "coding challenge", "hackerrank", "codility", "take-home test", "online test"]):
            return {
                "category": "ASSESSMENT",
                "confidence": 0.92,
                "jobTitle": job_title,
                "company": company,
                "suggestedStatus": None,
                "requiresResponse": True,
                "summary": f"Technical assessment request for {job_title or 'position'}",
            }

        if any(w in text for w in ["application received", "thank you for applying", "we have received your application", "application submitted"]):
            return {
                "category": "APPLICATION_CONFIRMATION",
                "confidence": 0.94,
                "jobTitle": job_title,
                "company": company,
                "suggestedStatus": "APPLIED",
                "requiresResponse": False,
                "summary": f"Application confirmation for {job_title or 'position'} at {company or 'company'}",
            }

        if any(w in text for w in ["reschedule", "interview update", "change of time", "feedback from interview"]):
            return {
                "category": "INTERVIEW_UPDATE",
                "confidence": 0.90,
                "jobTitle": job_title,
                "company": company,
                "suggestedStatus": "INTERVIEW",
                "requiresResponse": True,
                "summary": f"Interview update regarding {job_title or 'role'}",
            }

        if any(w in text for w in ["recruiter", "talent acquisition", "opportunity", "came across your profile", "chat about your background"]):
            return {
                "category": "RECRUITER_MESSAGE",
                "confidence": 0.88,
                "jobTitle": job_title,
                "company": company,
                "suggestedStatus": None,
                "requiresResponse": True,
                "summary": f"Recruiter message from {company or 'company'}",
            }

        return {
            "category": "OTHER",
            "confidence": 0.70,
            "jobTitle": job_title,
            "company": company,
            "suggestedStatus": None,
            "requiresResponse": False,
            "summary": "General communication",
        }

    # ----------------------------------------------------
    # 2. Zero-Fabrication Email Drafting
    # ----------------------------------------------------

    async def generate_email(
        self,
        candidate_profile: Optional[Dict[str, Any]],
        job_title: Optional[str],
        company: Optional[str],
        purpose: str = "APPLICATION_FOLLOW_UP",
        tone: str = "professional",
        email_context: Optional[str] = None,
        user_instructions: Optional[str] = None,
    ) -> Dict[str, Any]:
        candidate_name = "Candidate"
        if candidate_profile and candidate_profile.get("basics"):
            candidate_name = candidate_profile["basics"].get("name", "Candidate")

        user_prompt = f"""Compose a job search email with the following parameters:
- Purpose: {purpose}
- Tone: {tone}
- Candidate Name: {candidate_name}
- Job Title: {job_title or '[Job Title]'}
- Company: {company or '[Company Name]'}
- Additional User Instructions: {user_instructions or 'None'}

Reference Email Context:
<EMAIL_CONTEXT>
{email_context or 'No prior email context provided.'}
</EMAIL_CONTEXT>
"""
        model = await self.get_available_model()
        if model:
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(
                        f"{self.ollama_url}/api/generate",
                        json={
                            "model": model,
                            "system": EMAIL_GENERATION_SYSTEM_PROMPT,
                            "prompt": user_prompt,
                            "stream": False,
                            "options": {"temperature": 0.3},
                        },
                    )
                    if resp.status_code == 200:
                        raw = resp.json().get("response", "")
                        parsed = self.repair_json(raw)
                        if parsed and "body" in parsed:
                            return {
                                "subject": parsed.get("subject", f"Regarding {job_title or 'Application'} at {company or 'your team'}"),
                                "body": parsed.get("body", ""),
                                "purpose": purpose,
                                "warnings": parsed.get("warnings", []),
                            }
            except Exception as e:
                logger.warning(f"Ollama generation failed: {e}. Falling back to factual templates.")

        # Grounded Heuristic Template Fallback
        return self._heuristic_generate(candidate_name, job_title, company, purpose, tone)

    def _heuristic_generate(
        self,
        candidate_name: str,
        job_title: Optional[str],
        company: Optional[str],
        purpose: str,
        tone: str,
    ) -> Dict[str, Any]:
        role = job_title or "[Job Title]"
        target_company = company or "[Company Name]"
        warnings: List[str] = []

        if purpose == "APPLICATION_FOLLOW_UP":
            subject = f"Follow-up regarding {role} application - {candidate_name}"
            body = (
                f"Dear Hiring Team at {target_company},\n\n"
                f"I hope this message finds you well.\n\n"
                f"I am writing to follow up on my recent application for the {role} position. "
                f"I remain very enthusiastic about the opportunity to contribute to {target_company}, "
                f"and I would welcome the chance to discuss how my background aligns with your team's goals.\n\n"
                f"Please let me know if any additional information or documentation is needed on my end.\n\n"
                f"Thank you for your time and consideration.\n\n"
                f"Best regards,\n"
                f"{candidate_name}"
            )

        elif purpose == "RECRUITER_REPLY":
            subject = f"Re: {role} opportunity at {target_company} - {candidate_name}"
            body = (
                f"Hi there,\n\n"
                f"Thank you for reaching out regarding the {role} role at {target_company}.\n\n"
                f"I am interested in learning more about the position and the initiatives your team is working on. "
                f"I would be glad to schedule a brief call. I am generally available [Insert Availability, e.g. Tuesday and Thursday between 1:00 PM and 4:00 PM EST].\n\n"
                f"I have also attached my updated resume for your reference.\n\n"
                f"Looking forward to speaking with you.\n\n"
                f"Best regards,\n"
                f"{candidate_name}"
            )
            warnings.append("Please replace [Insert Availability] with your specific dates and times.")

        elif purpose == "INTERVIEW_CONFIRMATION":
            subject = f"Confirming Interview for {role} - {candidate_name}"
            body = (
                f"Hello,\n\n"
                f"Thank you for the invitation to interview for the {role} position at {target_company}.\n\n"
                f"I am pleased to confirm my attendance for the scheduled time [Insert Confirmed Date/Time]. "
                f"Please let me know if there are any specific topics, materials, or formats I should prepare ahead of our conversation.\n\n"
                f"Thank you again, and I look forward to speaking with the team.\n\n"
                f"Sincerely,\n"
                f"{candidate_name}"
            )
            warnings.append("Verify the date and time in [Insert Confirmed Date/Time].")

        elif purpose == "INTERVIEW_RESCHEDULE":
            subject = f"Reschedule Request: {role} Interview - {candidate_name}"
            body = (
                f"Hello,\n\n"
                f"Thank you for scheduling our interview for the {role} position. "
                f"Due to an unforeseen scheduling conflict, I would like to respectfully ask if it might be possible to reschedule our conversation.\n\n"
                f"I am available at the following alternative times: [Insert 2-3 Alternative Time Slots].\n\n"
                f"I apologize for any inconvenience this may cause and appreciate your understanding.\n\n"
                f"Best regards,\n"
                f"{candidate_name}"
            )
            warnings.append("Specify 2-3 alternative time slots.")

        elif purpose == "THANK_YOU":
            subject = f"Thank you - {role} interview - {candidate_name}"
            body = (
                f"Dear Interview Team,\n\n"
                f"Thank you for taking the time to speak with me today regarding the {role} position at {target_company}.\n\n"
                f"I really enjoyed our discussion about the role and learning more about the team's upcoming projects. "
                f"Our conversation reinforced my strong interest in joining {target_company}.\n\n"
                f"Please feel free to reach out if you need any further information. I look forward to hearing about next steps.\n\n"
                f"Best regards,\n"
                f"{candidate_name}"
            )

        elif purpose == "OFFER_RESPONSE":
            subject = f"Offer of Employment - {role} - {candidate_name}"
            body = (
                f"Dear {target_company} Team,\n\n"
                f"Thank you very much for extending the offer to join {target_company} as {role}. "
                f"I am very excited about the opportunity to work with the team.\n\n"
                f"I am currently reviewing the details of the offer and will follow up with you by [Insert Decision Date, e.g. Friday].\n\n"
                f"Thank you again for this wonderful opportunity.\n\n"
                f"Warm regards,\n"
                f"{candidate_name}"
            )
            warnings.append("Set your intended response date.")

        else:
            subject = f"Regarding {role} - {candidate_name}"
            body = (
                f"Hello,\n\n"
                f"Thank you for contacting me regarding {target_company}.\n\n"
                f"I appreciate your communication and look forward to continuing our discussion.\n\n"
                f"Best regards,\n"
                f"{candidate_name}"
            )

        return {
            "subject": subject,
            "body": body,
            "purpose": purpose,
            "warnings": warnings,
        }

email_service = EmailService()
