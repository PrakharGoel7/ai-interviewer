import json
from typing import Dict, Any, Optional
from schemas import GeneratedCase

CASE_GEN_SYSTEM = """You generate McKinsey-style case interview content.
Return ONLY valid JSON matching the schema for GeneratedCase:
{
  "background": "string",
  "stages": {
    "case_intro": {"readout": "string"},
    "structuring": {"primary_question": "string", "probe_question": "string"},
    "chart": {"chart_spec": {...}, "primary_question": "string", "probe_question": "string"},
    "math": {"primary_question": "string"},
    "creative": {"primary_question": "string", "probe_question": "string"},
    "end_feedback": {}
  }
}

Rules:
- Include realistic numbers.
- Chart_spec must be one of type: bar/line/scatter/table and include title + data.
- Math question must be solvable from stated data.
- Do NOT include solutions.
- Keep background 4–8 sentences.
"""

def generate_case(llm, case_theme: Optional[str] = None, difficulty: str = "medium") -> Dict[str, Any]:
    user_payload = {
        "theme": case_theme or "surprise me (but business-realistic)",
        "difficulty": difficulty,
        "industries_allowed": ["airlines", "retail", "telecom", "saas", "consumer", "manufacturing", "banking"],
        "stages_required": ["case_intro","structuring","chart","math","creative","end_feedback"]
    }

    text = llm.run_text(CASE_GEN_SYSTEM, user_payload)  # returns JSON text
    data = json.loads(text)
    case = GeneratedCase.model_validate(data)  # validate shape
    return case.model_dump()