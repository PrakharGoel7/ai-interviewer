from dataclasses import dataclass
from typing import List, Optional

@dataclass
class StageConfig:
    id: str
    title: str
    allowed_actions: List[str]
    rubric: Optional[List[str]]
    needs_chart: bool
    pattern: str  # "intro", "ask_probe", "ask_only", "end"

STAGES = [
    StageConfig(
        id="case_intro",
        title="Case intro/background",
        allowed_actions=["READ_CASE", "ASK_CLARIFY", "ANSWER_CLARIFY", "MOVE_ON", "NUDGE"],
        rubric=None,
        needs_chart=False,
        pattern="intro",
    ),
    StageConfig(
        id="structuring",
        title="Structuring question",
        allowed_actions=["ASK", "NUDGE", "PROBE", "INTERRUPT", "MOVE_ON"],
        rubric=["mece_coverage", "uniqueness"],
        needs_chart=False,
        pattern="ask_probe",
    ),
    StageConfig(
        id="chart",
        title="Graph interpretation question",
        allowed_actions=["SHOW_CHART", "ASK", "NUDGE", "PROBE", "INTERRUPT", "MOVE_ON"],
        rubric=["axes_units", "key_insights", "ties_to_hypothesis"],
        needs_chart=True,
        pattern="ask_probe",
    ),
    StageConfig(
        id="math",
        title="Math question",
        allowed_actions=["ASK", "NUDGE", "INTERRUPT", "MOVE_ON"],
        rubric=["thought_process", "setup", "arithmetic", "interpretation"],
        needs_chart=False,
        pattern="ask_only",
    ),
    StageConfig(
        id="creative",
        title="Creative question",
        allowed_actions=["ASK", "NUDGE", "PROBE", "INTERRUPT", "MOVE_ON"],
        rubric=["uniqueness"],
        needs_chart=False,
        pattern="ask_probe",
    ),
    StageConfig(
        id="end_feedback",
        title="End and feedback",
        allowed_actions=["DELIVER_FEEDBACK", "THANK_AND_CLOSE"],
        rubric=None,
        needs_chart=False,
        pattern="end",
    ),
]