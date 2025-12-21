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
- The chart stage MUST include a renderable chart_spec with this schema:
  {
    "type": "bar"|"line"|"scatter"|"table",
    "title": "string",
    "x_label": "string (optional)",
    "y_label": "string (optional)",
    "data":
      - if type is "bar": {"label": number, ...}
      - if type is "line": [{"x": "label or number", "y": number}, ...]  (or a mapping like bar)
      - if type is "scatter": [{"x": number, "y": number}, ...]
      - if type is "table": [{"col1": value, "col2": value, ...}, ...]
  }
- Ensure all numeric values used for interpretation are present in chart_spec.data.
- The chart primary_question must explicitly ask for 2–3 observations AND implications/next steps.
- The math question must be solvable from stated data, and should be 1–2 steps of mental math.

EXAMPLES (for style + structure only; do not copy verbatim text, names, industries, or numbers)

EXAMPLE 1 — Conservation NGO prioritization + ecotourism
- Setup: A conservation-focused NGO formed in the early 2010s must prioritize among a shortlist of geographies for restoration/conservation. Context includes biodiversity decline, ecosystem services, multi-stakeholder coordination, legal/financing complexity.
- structuring: Ask for a MECE framework to choose which geography to prioritize (impact, feasibility, funding, stakeholders, risk, etc.).
- math: Provide assumptions for an ecotourism pilot (baseline visitors, expected growth over 5 years, length of stay change, spend per day) and ask for incremental revenue in year 5.
- creative: Ask for ideas to maximize each lever (visitors, length of stay, spend/day) plus “outside the model” revenue ideas.
- chart: Show a comparison of candidate communities (e.g., expected new visitors vs required investment and ROI) and ask which to prioritize and why.

EXAMPLE 2 — Beverage launch strategy (Electrolyte drink)
- Setup: A top-three US beverage company with integrated supply chain is considering launching a lower-sugar electrolyte sports drink to capture a trend away from high-sugar products. Client needs a product launch strategy and internal capability assessment.
- structuring: Ask what key factors determine whether to launch (market attractiveness, customer segments, competitive response, channel, cannibalization, ops readiness, economics, brand fit, regulatory, etc.).
- chart: Show market-share or category-split exhibit (e.g., electrolyte segment size + major competitors’ shares) and ask for observations / implications for entry.
- math: Give price to retailers, fixed launch costs, unit cost, and market sizing info; ask what market share is needed to break even.
- creative: Ask what the company must do to achieve the target share post-launch (distribution, pricing/promo, positioning, partnerships, sales execution), then probe on risks/second-order effects.

EXAMPLE 3 — National education system transformation
- Setup: A fictional Eastern European country wants to improve education quantity and quality over a decade to support economic development; schooling is public, ages 5–18; first step is diagnosing current system performance.
- structuring: Ask what issues to investigate in diagnosing the current state (access/enrollment, learning outcomes, teacher quality, funding, governance, infrastructure, equity, curriculum, assessment, etc.).
- chart: Show education metrics for the country vs (1) neighbors (2) developed European economies (3) similar GDP-per-capita peers; ask for key observations and what they imply.
- math: Provide a fact about current student population share and a comparator’s average school size; ask what reduction in number of schools would result if the country matched the comparator’s average school size.
- creative: Ask for improvement initiatives and sequencing/tradeoffs (quick wins vs long-term, political feasibility, implementation capacity), and probe for risks.

END OF EXAMPLES

Now generate ONE NEW case (different client + different industry + new numbers) that matches the same quality bar and stage intent. Return ONLY the JSON.
"""

def generate_case(llm, case_theme: Optional[str] = None, difficulty: str = "medium") -> Dict[str, Any]:
    user_payload = {
        "theme": case_theme or "surprise me (but business-realistic)",
        "difficulty": difficulty,
        "industries_allowed": ["airlines", "retail", "telecom", "saas", "consumer", "manufacturing", "banking"],
        "stages_required": ["case_intro","structuring","chart","math","creative","end_feedback"]
    }

    last_error = None
    for attempt in range(1, 4):
        text = llm.run_text(CASE_GEN_SYSTEM, user_payload)  # returns JSON text
        try:
            data = json.loads(text)
            case = GeneratedCase.model_validate(data)  # validate shape
            return case.model_dump()
        except json.JSONDecodeError as exc:
            print(f"⚠️  Case generation attempt {attempt} returned invalid JSON: {exc}")
            print("Raw response snippet:", text[:500])
            last_error = exc
    raise ValueError("Unable to generate valid case JSON after 3 attempts") from last_error
