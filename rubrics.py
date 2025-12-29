"""
Consulting interview scoring rubric.
- Each dimension scored 1-5 (3 = baseline, 5 = interview-ready, 1 = major gap).
- Score only on observed behavior.
"""

FRAMEWORK_RUBRIC = {
    "structure_mece": "Presented a MECE, logically organized structure.",
    "branch_depth": "Demonstrated sufficient depth within each branch (beyond high-level labels).",
}

GRAPH_RUBRIC = {
    "accurate_description": "Accurately described the chart’s axes, units, trends, and comparisons.",
    "key_takeaways": "Identified key patterns, takeaways, or notable deltas.",
    "implications_next_steps": "Stated implications or next steps beyond surface-level description.",
}

QUANT_RUBRIC = {
    "thought_process": "Clearly walked through the thought process and setup.",
    "math_accuracy": "Performed accurate calculations.",
    "business_interpretation": "Interpreted the result in a business context (what the number means).",
}

CREATIVE_RUBRIC = {
    "differentiated_ideas": "Generated non-obvious, differentiated ideas.",
    "case_relevance": "Ensured ideas were relevant to the case context and objectives.",
}

SYNTHESIS_RUBRIC = {
    "explicit_recommendation": "Explicitly stated a recommendation or clear answer.",
    "evidence_support": "Supported the recommendation with evidence from prior analysis.",
    "risks_next_steps": "Acknowledged risks, tradeoffs, or next steps.",
}

COMMUNICATION_RUBRIC = {
    "top_down": "Communicated in a top-down, structured manner.",
    "clarity_confidence": "Spoke clearly, coherently, and confidently.",
    "concise": "Avoided rambling or unnecessary backtracking.",
}

DIMENSION_CONFIG = {
    "framework_structuring": {"title": "Framework Structuring", "criteria": FRAMEWORK_RUBRIC},
    "graph_interpretation": {"title": "Graph Interpretation", "criteria": GRAPH_RUBRIC},
    "quantitative_analysis": {"title": "Quantitative Analysis", "criteria": QUANT_RUBRIC},
    "creative_problem_solving": {"title": "Creative Problem Solving", "criteria": CREATIVE_RUBRIC},
    "synthesis_recommendation": {"title": "Synthesis & Recommendation", "criteria": SYNTHESIS_RUBRIC},
    "communication": {"title": "Communication", "criteria": COMMUNICATION_RUBRIC},
}

DIMENSION_ORDER = [
    "framework_structuring",
    "graph_interpretation",
    "quantitative_analysis",
    "creative_problem_solving",
    "synthesis_recommendation",
    "communication",
]

CRITERION_TO_DIMENSION = {}
for dim_key, cfg in DIMENSION_CONFIG.items():
    for criterion_key in cfg["criteria"].keys():
        CRITERION_TO_DIMENSION[criterion_key] = dim_key

STAGE_DIMENSION_MAP = {
    "structuring": "framework_structuring",
    "chart": "graph_interpretation",
    "math": "quantitative_analysis",
    "creative": "creative_problem_solving",
    "recommendation": "synthesis_recommendation",
}
