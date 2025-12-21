from dataclasses import dataclass
from typing import List, Optional
from rubrics import STRUCTURING_RUBRIC, CHART_RUBRIC, MATH_RUBRIC, CREATIVE_RUBRIC

@dataclass
class StageConfig:
    id: str
    title: str
    allowed_actions: List[str]
    rubric: Optional[List[str]]
    needs_chart: bool
    pattern: str  # "intro", "ask_probe", "ask_only", "end"
    interviewer_name: str
    interviewer_persona: str
    guidance: str
    max_interviewer_turns: Optional[int] = None

STAGES = [
    StageConfig(
        id="case_intro",
        title="Case intro/background",
        allowed_actions=["READ_CASE", "ASK_CLARIFY", "ANSWER_CLARIFY"],
        rubric=None,
        needs_chart=False,
        pattern="intro",
        interviewer_name="Jordan (Case Opener)",
        interviewer_persona="Warm yet efficient engagement manager focused on framing the client situation and clarifying scope.",
        guidance="Read the background, then ask whether the candidate has clarifying questions. Answer any clarifying questions briefly. When you answer a clarifying question, ask if the user has any more questions. Only end the stage once the candidate says they have no more clarifying questions.",
    ),
    StageConfig(
        id="structuring",
        title="Structuring question",
        allowed_actions=["ASK", "PROBE"],
        rubric=list(STRUCTURING_RUBRIC.keys()),
        needs_chart=False,
        pattern="ask_probe",
        interviewer_name="Riya (Structure Lead)",
        interviewer_persona="Detail-oriented strategy consultant who insists on MECE, hypothesis-driven approaches.",
        guidance="Ask the structuring question once. After the candidate answers, ask exactly one targeted probe to pressure-test their structure, then close the stage.",
        max_interviewer_turns=2,
    ),
    StageConfig(
        id="chart",
        title="Graph interpretation question",
        allowed_actions=["SHOW_CHART", "ASK", "PROBE"],
        rubric=list(CHART_RUBRIC.keys()),
        needs_chart=True,
        pattern="ask_only",
        interviewer_name="Leo (Insights Specialist)",
        interviewer_persona="Data visualization expert who guides candidates through exhibits crisply and expects insight + implication.",
        guidance="Display the chart while asking the primary interpretation question. Wait for the candidate's answer and then end the stage.",
        max_interviewer_turns=1,
    ),
    StageConfig(
        id="math",
        title="Math question",
        allowed_actions=["ASK", "PROBE"],
        rubric=list(MATH_RUBRIC.keys()),
        needs_chart=False,
        pattern="ask_probe",
        interviewer_name="Sofia (Quant Coach)",
        interviewer_persona="Calm, precise problem solver focused on structured mental math with clear units.",
        guidance="Ask the math question once. After the candidate answers, ask exactly one probe (e.g., sanity check, sensitivity, implication) and then end the stage.",
        max_interviewer_turns=2,
    ),
    StageConfig(
        id="creative",
        title="Creative question",
        allowed_actions=["ASK", "PROBE"],
        rubric=list(CREATIVE_RUBRIC.keys()),
        needs_chart=False,
        pattern="ask_probe",
        interviewer_name="Marcus (Brainstorm Facilitator)",
        interviewer_persona="Encouraging senior partner pushing for bold, structured ideation and business judgment.",
        guidance="Run a creative brainstorming question with at most one follow-up probe to push depth. Wrap once the candidate has responded.",
        max_interviewer_turns=2,
    ),
    StageConfig(
        id="end_feedback",
        title="End and feedback",
        allowed_actions=["DELIVER_FEEDBACK", "THANK_AND_CLOSE"],
        rubric=None,
        needs_chart=False,
        pattern="end",
        interviewer_name="Ava (Feedback Moderator)",
        interviewer_persona="Synthesizes feedback from other interviewers and communicates next steps with empathy.",
        guidance="Summarize the interview using the other interviewers' notes plus rubric evaluations. Structure it as Strengths section, then improvement, then overall conclusion, and then thank the candidate.",
        max_interviewer_turns=1,
    ),
]
