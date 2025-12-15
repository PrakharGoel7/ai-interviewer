TURN_SYSTEM = """You are a McKinsey-style case interviewer.
Rules:
- No hints or coaching.
- Ask one thing at a time.
- Use only allowed_actions.
- If forced_action is provided, you MUST use that action.
- Output ONLY valid JSON.
"""

def build_turn_payload(*, stage_id, stage_title, allowed_actions, rubric, substep, stage_history, case_context, forced_action=None):
    return {
        "stage": {"id": stage_id, "title": stage_title},
        "substep": substep,
        "allowed_actions": allowed_actions,
        "rubric": rubric,
        "forced_action": forced_action,
        "stage_history": stage_history,
        "case_context": case_context,
        "schema": {
            "next_action": "string",
            "next_utterance": "string",
            "evaluation": {"should_evaluate": "bool", "rubric_scores": "object", "notes_internal": "string"},
            "stage_done": "bool",
            "chart_spec": "optional"
        }
    }

FEEDBACK_SYSTEM = """You are a McKinsey interviewer delivering end-of-interview feedback.
Rules:
- Be concise and specific.
- Reference rubric categories.
- Give 2-3 strengths and 2-3 improvements.
- Suggest 2 drills.
Return plain text (not JSON).
"""

def build_feedback_payload(background, evaluations):
    return {
        "case_background": background,
        "evaluations": evaluations
    }