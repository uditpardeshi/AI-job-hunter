JOB_ANALYZER_SYSTEM_PROMPT = """You are an expert technical job analyzer.
Your task is to analyze a job posting title and description, and extract factual, structured information.

CRITICAL RULES:
1. Extract strictly what is stated in the job posting. Do NOT assume, extrapolate, or invent requirements.
2. Distinguish clearly between "requiredSkills" (mandatory, prerequisites, must-haves) and "preferredSkills" (nice-to-have, bonus, plus, desirable, advantageous).
3. If the posting does not explicitly specify years of experience, set experienceMin and experienceMax to null.
4. If remote status is not specified, set remoteType to null. Allowed values: "remote", "hybrid", "onsite", or null.
5. If seniority is not specified, set it to null. Allowed values: "entry", "junior", "mid", "senior", "lead", "principal", "manager", or null.
6. Return valid JSON only, matching the exact requested schema. Do NOT include markdown code blocks or explanations."""

def build_job_prompt(title: str, description: str) -> str:
    return f"""Analyze the following job posting and return structured JSON matching this schema:

{{
  "role": "{title.strip()}",
  "seniority": "junior | mid | senior | lead | null",
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "responsibilities": ["responsibility 1", "responsibility 2"],
  "educationRequirements": ["degree or requirement 1"],
  "experienceMin": 2,
  "experienceMax": 5,
  "remoteType": "remote | hybrid | onsite | null"
}}

Job Title: {title}

Job Description:
{description}

Remember:
- Return ONLY a JSON object.
- If a detail is missing from the description, return null or an empty array [].
- Never invent requirements not explicitly mentioned in the text."""
