from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal, Union, List

Action = Literal[
    "READ_CASE", "ASK_CLARIFY", "ANSWER_CLARIFY", "MOVE_ON", "NUDGE",
    "ASK", "PROBE", "INTERRUPT",
    "SHOW_CHART",
    "DELIVER_FEEDBACK", "THANK_AND_CLOSE"
]

class GeneratedCase(BaseModel):
    background: str
    stages: Dict[str, Dict[str, Any]]

class Evaluation(BaseModel):
    should_evaluate: bool = False
    rubric_scores: Dict[str, int] = Field(default_factory=dict)  # 0-5
    notes_internal: str = ""

class ChartSpec(BaseModel):
    type: Literal["bar", "line", "scatter", "table"]
    title: str
    x_label: Optional[str] = None
    y_label: Optional[str] = None
    data: Union[Dict[str, Any], List[Any]]

class LLMTurnOutput(BaseModel):
    next_action: Action
    next_utterance: str
    evaluation: Evaluation = Field(default_factory=Evaluation)
    stage_done: bool = False
    chart_spec: Optional[ChartSpec] = None