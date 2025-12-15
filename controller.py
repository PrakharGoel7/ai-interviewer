from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Literal
import time

from stages import STAGES, StageConfig
from prompts import TURN_SYSTEM, FEEDBACK_SYSTEM, build_turn_payload, build_feedback_payload

Role = Literal["student", "interviewer"]

def now_ms() -> int:
    return int(time.time() * 1000)

@dataclass
class Event:
    role: Role
    stage_id: str
    text: str
    ts_ms: int
    meta: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Session:
    case_id: str
    stage_index: int = 0
    substep: str = "START"  # START, PRIMARY_ASKED, PROBE_ASKED, DONE
    events: List[Event] = field(default_factory=list)
    evaluations: List[Dict[str, Any]] = field(default_factory=list)

def advance_substep(stage: StageConfig, substep: str) -> str:
    if stage.pattern == "ask_probe":
        return {"START": "PRIMARY_ASKED", "PRIMARY_ASKED": "PROBE_ASKED", "PROBE_ASKED": "DONE"}.get(substep, "DONE")
    if stage.pattern == "ask_only":
        return {"START": "PRIMARY_ASKED", "PRIMARY_ASKED": "DONE"}.get(substep, "DONE")
    if stage.pattern == "end":
        return {"START": "PRIMARY_ASKED", "PRIMARY_ASKED": "DONE"}.get(substep, "DONE")
    # intro handled separately
    return substep

class InterviewController:
    def __init__(self, case_store, llm_client, case_generator_fn):
        self.case_store = case_store
        self.llm = llm_client
        self.case_generator_fn = case_generator_fn

    def current_stage(self, session: Session) -> StageConfig:
        return STAGES[session.stage_index]

    def stage_history(self, session: Session, stage_id: str) -> List[Dict[str, Any]]:
        evs = [e for e in session.events if e.stage_id == stage_id]
        return [{"role": e.role, "text": e.text, "ts_ms": e.ts_ms, "meta": e.meta} for e in evs]

    def debug_set_position(self, session: Session, *, stage_id: str, substep: str = "START") -> None:
        """
        Debug-only: jump session to a given stage/substep.
        stage_id: one of the ids in STAGES (e.g. 'chart', 'math')
        substep: 'START', 'PRIMARY_ASKED', 'PROBE_ASKED'
        """
        # Ensure a case exists
        if not getattr(session, "case_generated", False):
            case_obj = self.case_generator_fn()
            self.case_store.put_case(session.case_id, case_obj)
            session.case_generated = True

        idx = next(i for i, s in enumerate(STAGES) if s.id == stage_id)
        session.stage_index = idx
        session.substep = substep
    
    def emit_current_prompt(self, session: Session) -> Dict[str, Any]:
        """
        Deterministically emits the stage's primary/probe question (and chart spec if needed)
        based on current stage + substep. Great for testing.
        """
        stage = self.current_stage(session)
        ctx = self.case_store.get_stage_context(session.case_id, stage.id)
        s = ctx["stage"]

        if stage.id == "case_intro":
            readout = s.get("readout", "")
            utterance = f"{readout}\n\nDo you have any clarifying questions before we begin?"
            action = "READ_CASE"
            chart_spec = None

        elif stage.id == "chart":
            chart_spec = s["chart_spec"]
            if session.substep in ("START", "PRIMARY_ASKED"):
                utterance = s["primary_question"]
            else:
                utterance = s["probe_question"]
            action = "SHOW_CHART"

        else:
            chart_spec = None
            if session.substep in ("START", "PRIMARY_ASKED"):
                utterance = s.get("primary_question", "Proceed.")
                action = "ASK"
            else:
                utterance = s.get("probe_question", "Proceed.")
                action = "PROBE"

        # log interviewer event
        session.events.append(Event(
            role="interviewer",
            stage_id=stage.id,
            text=utterance,
            ts_ms=now_ms(),
            meta={"action": action, "chart_spec": chart_spec}
        ))

        # After emitting, mark as asked
        if session.substep == "START":
            session.substep = "PRIMARY_ASKED"
        elif session.substep == "PRIMARY_ASKED" and stage.pattern == "ask_probe":
            session.substep = "PROBE_ASKED"

        return {"next_action": action, "next_utterance": utterance, "chart_spec": chart_spec}
    def start(self, session: Session) -> Dict[str, Any]:
        # 1) generate case once
        if not getattr(session, "case_generated", False):
            case_obj = self.case_generator_fn()
            self.case_store.put_case(session.case_id, case_obj)
            session.case_generated = True

        # 2) deterministic first utterance: read case + ask clarifying
        stage = self.current_stage(session)  # should be case_intro
        ctx = self.case_store.get_stage_context(session.case_id, stage.id)

        readout = ctx["stage"].get("readout")
        if not readout:
            raise ValueError("case_intro.readout missing from generated case.")

        utterance = (
            f"{readout}\n\n"
            "Do you have any clarifying questions before we begin?"
        )

        session.events.append(Event(
            role="interviewer",
            stage_id=stage.id,
            text=utterance,
            ts_ms=now_ms(),
            meta={"action": "READ_CASE"}
        ))

        # We are now waiting for clarifying questions
        session.substep = "PRIMARY_ASKED"
        return {"next_action": "READ_CASE", "next_utterance": utterance, "chart_spec": None}

    def step(self, session: Session, student_text: str) -> Dict[str, Any]:
        stage = self.current_stage(session)

        # log student
        session.events.append(Event(role="student", stage_id=stage.id, text=student_text, ts_ms=now_ms()))

        # intro stage: clarifying loop rule (very simple MVP)
        # If student says "no" (or similar), move on. Otherwise treat as clarifying Q.
        if stage.id == "case_intro":
            if student_text.strip().lower() in {"no", "nope", "no questions", "no clarifying questions"}:
                # advance to next stage
                session.stage_index += 1
                session.substep = "START"
                return self._run_llm_for_current_stage(session)
            else:
                # Answer clarifying question, remain in intro
                return self._run_llm_for_current_stage(session)

        # other stages: always follow your fixed flow; LLM provides utterance + eval
        out = self._run_llm_for_current_stage(session)

        # deterministic progression
        session.substep = advance_substep(stage, session.substep)
        if session.substep == "DONE":
            session.stage_index += 1
            session.substep = "START"

            # if we just finished creative, next is feedback; trigger feedback automatically
            if session.stage_index < len(STAGES) and STAGES[session.stage_index].id == "end_feedback":
                return self._run_feedback(session)

        return out

    def _run_llm_for_current_stage(self, session: Session) -> Dict[str, Any]:
        stage = self.current_stage(session)
        forced_action = None
        if stage.id == "case_intro":
            forced_action = "ANSWER_CLARIFY"
        ctx = self.case_store.get_stage_context(session.case_id, stage.id)
        payload = build_turn_payload(
            stage_id=stage.id,
            stage_title=stage.title,
            allowed_actions=stage.allowed_actions,
            rubric=stage.rubric,
            substep=session.substep,
            stage_history=self.stage_history(session, stage.id),
            case_context=ctx,
        )
        out = self.llm.run_json(TURN_SYSTEM, payload)
        if forced_action and out.next_action != forced_action:
            # simplest MVP: override action but keep utterance
            out.next_action = forced_action

        # store evaluation if model says so
        if out.evaluation and out.evaluation.should_evaluate:
            hist = self.stage_history(session, stage.id)
            student_last = next((x["text"] for x in reversed(hist) if x["role"] == "student"), None)

            # Only store an eval if we actually have a student response in this stage
            if student_last is not None:
                session.evaluations.append({
                    "stage_id": stage.id,
                    "substep": session.substep,
                    "scores": out.evaluation.rubric_scores,
                    "notes": out.evaluation.notes_internal,
                    "student_last": student_last,
                })

        # log interviewer
        session.events.append(Event(
            role="interviewer",
            stage_id=stage.id,
            text=out.next_utterance,
            ts_ms=now_ms(),
            meta={"action": out.next_action, "chart_spec": out.chart_spec.model_dump() if out.chart_spec else None}
        ))
        return out.model_dump()

    def _run_feedback(self, session: Session) -> Dict[str, Any]:
        # feedback uses whole interview evals
        case = self.case_store.load_case(session.case_id)
        payload = build_feedback_payload(case["background"], session.evaluations)
        text = self.llm.run_text(FEEDBACK_SYSTEM, payload)

        stage = self.current_stage(session)  # end_feedback
        session.events.append(Event(role="interviewer", stage_id=stage.id, text=text, ts_ms=now_ms(), meta={"action": "DELIVER_FEEDBACK"}))

        # end
        closing = "Thanks for your time — that’s the end of the interview."
        session.events.append(Event(role="interviewer", stage_id=stage.id, text=closing, ts_ms=now_ms(), meta={"action": "THANK_AND_CLOSE"}))
        session.stage_index = len(STAGES)  # mark complete
        return {"next_action": "DELIVER_FEEDBACK", "next_utterance": text, "chart_spec": None}