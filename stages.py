from dataclasses import dataclass
from typing import List, Optional
from rubrics import (
    FRAMEWORK_RUBRIC,
    GRAPH_RUBRIC,
    QUANT_RUBRIC,
    CREATIVE_RUBRIC,
    SYNTHESIS_RUBRIC,
    COMMUNICATION_RUBRIC,
)

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
        rubric=list(FRAMEWORK_RUBRIC.keys()) + list(COMMUNICATION_RUBRIC.keys()),
        needs_chart=False,
        pattern="ask_probe",
        interviewer_name="Riya (Structure Lead)",
        interviewer_persona="Detail-oriented strategy consultant who insists on structured, hypothesis-driven approaches.",
        guidance="Ask the structuring question once. After the candidate answers, ask exactly one targeted probe to pressure-test their structure, then close the stage.",
        max_interviewer_turns=2,
    ),
    StageConfig(
        id="chart",
        title="Graph interpretation question",
        allowed_actions=["SHOW_CHART", "ASK", "PROBE"],
        rubric=list(GRAPH_RUBRIC.keys()) + list(COMMUNICATION_RUBRIC.keys()),
        needs_chart=True,
        pattern="ask_only",
        interviewer_name="Leo (Insights Specialist)",
        interviewer_persona="Data visualization expert who guides candidates through exhibits crisply and expects insight + implication.",
        guidance="Display the chart while asking the primary interpretation question. Start this utterance with a brief acknowledgement of the candidate's last answer, then present the interpretation question while the chart is visible. Wait for the candidate's answer and then end the stage.",
        max_interviewer_turns=1,
    ),
    StageConfig(
        id="math",
        title="Math question",
        allowed_actions=["ASK", "PROBE"],
        rubric=list(QUANT_RUBRIC.keys()) + list(COMMUNICATION_RUBRIC.keys()),
        needs_chart=False,
        pattern="ask_probe",
        interviewer_name="Sofia (Quant Coach)",
        interviewer_persona="Calm, precise problem solver focused on structured mental math with clear units.",
        guidance="Ask the math question once. Begin each utterance by briefly acknowledging the candidate's immediately preceding answer, then deliver the question. After the candidate answers, ask exactly one probe (e.g., sanity check, sensitivity, implication) and then end the stage.",
        max_interviewer_turns=2,
    ),
    StageConfig(
        id="creative",
        title="Creative question",
        allowed_actions=["ASK", "PROBE"],
        rubric=list(CREATIVE_RUBRIC.keys()) + list(COMMUNICATION_RUBRIC.keys()),
        needs_chart=False,
        pattern="ask_probe",
        interviewer_name="Marcus (Brainstorm Facilitator)",
        interviewer_persona="Encouraging senior partner pushing for bold, structured ideation and business judgment.",
        guidance="Run a creative brainstorming question with at most one follow-up probe to push depth. Each utterance should open with a short acknowledgement of the candidate's prior answer before asking the next question. Wrap once the candidate has responded.",
        max_interviewer_turns=2,
    ),
    StageConfig(
        id="recommendation",
        title="Recommendation summary",
        allowed_actions=["ASK"],
        rubric=list(SYNTHESIS_RUBRIC.keys()) + list(COMMUNICATION_RUBRIC.keys()),
        needs_chart=False,
        pattern="ask_only",
        interviewer_name="Elena (Client Lead)",
        interviewer_persona="Executive sponsor focused on clear, confident synthesis that ties back to business impact.",
        guidance="Prompt the candidate once to summarize their recommendation to the client, explicitly asking for supporting evidence and next steps. Do not probe further—listen to their response and then close the stage.",
        max_interviewer_turns=1,
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
        guidance="Summarize the interview using the other interviewers' notes plus rubric evaluations. Structure it as Strengths section, then Improvement section, then overall Conclusion, and then thank the candidate. Do not mention the names of the interviewers.",
        max_interviewer_turns=1,
    ),
]
