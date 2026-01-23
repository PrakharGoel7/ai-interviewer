import json
from typing import Dict, Any, Optional
from schemas import GeneratedCase

CONSULTING_CASE_TYPES = ["M&A", "Market Entry", "Profitability", "Market Share"]

REQUIRED_STAGES = {
    "case_intro": ["readout"],
    "structuring": ["primary_question", "probe_question"],
    "chart": ["primary_question", "probe_question", "chart_spec"],
    "math": ["primary_question"],
    "creative": ["primary_question", "probe_question"],
    "recommendation": ["primary_question"],
    "end_feedback": [],
}

CASE_GEN_SYSTEM = """You generate McKinsey-style case interview content.
Return ONLY valid JSON matching the schema for GeneratedCase:
{
  "title": "string",
  "type": "string",
  "industry": "string",
  "background": "string",
  "stages": {
    "case_intro": {"readout": "string"},
    "structuring": {"primary_question": "string", "probe_question": "string"},
    "chart": {"chart_spec": {...}, "primary_question": "string", "probe_question": "string"},
    "math": {"primary_question": "string"},
    "creative": {"primary_question": "string", "probe_question": "string"},
    "recommendation": {"primary_question": "string"},
    "end_feedback": {}
  }
}

Rules:
- Set `title` to a concise 5-8 word case descriptor (e.g., "Regional Airline Profitability Decline").
- Set `type` to the interview archetype (e.g., Profitability, Market Entry, M&A).
- Set `industry` to the client's primary industry.
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
- The math question should contain all the data needed to solve the question, and should be 4-5 steps of mental math.
- The recommendation stage should include a prompt asking the candidate to synthesize a final recommendation, referencing the earlier findings and highlighting supporting evidence + next steps.
- If a case_type is provided (e.g., M&A, Market Entry, Profitability, Market Share), tailor the overall situation, title, and questions to that archetype.

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

def _validate_case(case: Dict[str, Any]) -> None:
    stages = case.get("stages") or {}
    if not case.get("background"):
        raise ValueError("Generated case missing background.")
    for stage_id, fields in REQUIRED_STAGES.items():
        if stage_id not in stages:
            raise ValueError(f"Generated case missing stage '{stage_id}'.")
        stage = stages.get(stage_id) or {}
        for field in fields:
            if field not in stage or stage.get(field) in (None, ""):
                raise ValueError(f"Generated case stage '{stage_id}' missing '{field}'.")
        if stage_id == "chart":
            chart = stage.get("chart_spec") or {}
            for key in ("type", "title", "data"):
                if key not in chart or chart.get(key) in (None, ""):
                    raise ValueError("Generated case chart_spec missing required fields.")


def _fallback_case(case_type: Optional[str] = None) -> Dict[str, Any]:
    resolved_type = case_type if case_type in CONSULTING_CASE_TYPES else "Profitability"
    return {
        "title": "Regional Grocery Chain Margin Slide",
        "type": resolved_type,
        "industry": "Retail",
        "background": (
            "A regional grocery chain with 120 stores has seen operating margin "
            "decline over the last two years. The CEO wants to understand the drivers "
            "and identify actions to restore margins within 12 months."
        ),
        "stages": {
            "case_intro": {
                "readout": (
                    "Our client is a regional grocery chain with 120 stores across the Midwest. "
                    "Operating margin has declined from 6% to 3% over two years. "
                    "The CEO wants to understand the drivers and restore margins within 12 months."
                )
            },
            "structuring": {
                "primary_question": "How would you structure this problem to diagnose the margin decline?",
                "probe_question": "Which data sources would you prioritize first and why?",
            },
            "chart": {
                "primary_question": "What are 2-3 observations from this exhibit, and what do they imply?",
                "probe_question": "What actions would you test based on these trends?",
                "chart_spec": {
                    "type": "bar",
                    "title": "Store Profit by Region (Last FY)",
                    "x_label": "Region",
                    "y_label": "Profit ($M)",
                    "data": {"North": 14, "South": 9, "East": 6, "West": 4},
                },
            },
            "math": {
                "primary_question": (
                    "If average basket size is $45 and daily transactions drop by 1,500 across the chain, "
                    "what is the annual revenue impact?"
                )
            },
            "creative": {
                "primary_question": "What levers could the client pull to improve margin within a year?",
                "probe_question": "Which initiatives would you prioritize and why?",
            },
            "recommendation": {
                "primary_question": "What is your recommendation to the CEO, and what are the next steps?",
            },
            "end_feedback": {},
        },
    }


def generate_case(llm, case_theme: Optional[str] = None, difficulty: str = "medium", case_type: Optional[str] = None) -> Dict[str, Any]:
    user_payload = {
        "theme": case_theme or "surprise me (but business-realistic)",
        "difficulty": difficulty,
        "industries_allowed": ["airlines", "retail", "telecom", "saas", "consumer", "manufacturing", "banking"],
        "stages_required": ["case_intro","structuring","chart","math","creative","recommendation","end_feedback"],
    }
    if case_type:
        user_payload["case_type"] = case_type

    last_error = None
    for attempt in range(1, 4):
        try:
            text = llm.run_text(CASE_GEN_SYSTEM, user_payload)  # returns JSON text
            data = json.loads(text)
            case = GeneratedCase.model_validate(data)  # validate shape
            case_payload = case.model_dump()
            _validate_case(case_payload)
            return case_payload
        except Exception as exc:
            print(f"⚠️  Case generation attempt {attempt} failed: {exc}")
            if "text" in locals():
                print("Raw response snippet:", text[:500])
            last_error = exc
    print("⚠️  Falling back to a static consulting case.")
    return _fallback_case(case_type)
