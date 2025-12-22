from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Literal
import time

from stages import STAGES, StageConfig
from prompts import TURN_SYSTEM, EVAL_SYSTEM, FEEDBACK_SYSTEM, build_turn_payload, build_feedback_payload, build_eval_payload
from schemas import ChartSpec, LLMStageEvaluation

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
    pending_outputs: List[Dict[str, Any]] = field(default_factory=list)
    stage_feedback_notes: List[Dict[str, Any]] = field(default_factory=list)
    utterances_this_stage: int = 0

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

    def _ensure_case(self, session: Session) -> None:
        case_loaded = False
        if getattr(session, "case_generated", False):
            try:
                self.case_store.load_case(session.case_id)
                case_loaded = True
            except KeyError:
                case_loaded = False
        if not case_loaded:
            case_obj = self.case_generator_fn()
            self.case_store.put_case(session.case_id, case_obj)
            session.case_generated = True

    def current_stage(self, session: Session) -> StageConfig:
        return STAGES[session.stage_index]

    def stage_history(self, session: Session, stage_id: str) -> List[Dict[str, Any]]:
        evs = [e for e in session.events if e.stage_id == stage_id]
        return [{"role": e.role, "text": e.text, "ts_ms": e.ts_ms, "meta": e.meta} for e in evs]

    def pop_next_pending_output(self, session: Session) -> Optional[Dict[str, Any]]:
        if not session.pending_outputs:
            return None
        return session.pending_outputs.pop(0)

    def flush_pending_outputs(self, session: Session) -> List[Dict[str, Any]]:
        outs = list(session.pending_outputs)
        session.pending_outputs.clear()
        return outs

    def _queue_output(self, session: Session, out: Dict[str, Any]) -> None:
        session.pending_outputs.append(out)

    def _record_stage_note(self, session: Session, stage: StageConfig, note: str) -> None:
        if not note:
            return
        existing = next((n for n in session.stage_feedback_notes if n["stage_id"] == stage.id), None)
        payload = {"stage_id": stage.id, "interviewer": stage.interviewer_name, "note": note}
        if existing:
            existing.update(payload)
        else:
            session.stage_feedback_notes.append(payload)

    def debug_set_position(self, session: Session, *, stage_id: str, substep: str = "START") -> None:
        """
        Debug-only: jump session to a given stage/substep.
        stage_id: one of the ids in STAGES (e.g. 'chart', 'math')
        substep: 'START', 'PRIMARY_ASKED', 'PROBE_ASKED'
        """
        # Ensure a case exists
        self._ensure_case(session)

        idx = next(i for i, s in enumerate(STAGES) if s.id == stage_id)
        session.stage_index = idx
        session.substep = substep
        session.utterances_this_stage = 0
    
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
        session.utterances_this_stage += 1

        return {"next_action": action, "next_utterance": utterance, "chart_spec": chart_spec, "stage_id": stage.id}

    def _complete_stage(self, session: Session, finished_stage: StageConfig) -> None:
        session.stage_index += 1
        if session.stage_index >= len(STAGES):
            session.substep = "DONE"
            return

        session.substep = "START"
        session.utterances_this_stage = 0
        next_stage = self.current_stage(session)

        if next_stage.id == "end_feedback":
            out = self._run_feedback(session)
            self._queue_output(session, out)
            return

        out = self.emit_current_prompt(session)
        self._queue_output(session, out)

    def start(self, session: Session) -> Dict[str, Any]:
        # 1) generate case once
        self._ensure_case(session)

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
        session.utterances_this_stage = 1
        return {"next_action": "READ_CASE", "next_utterance": utterance, "chart_spec": None, "stage_id": stage.id}

    def step(self, session: Session, student_text: str) -> Dict[str, Any]:
        self._ensure_case(session)
        stage = self.current_stage(session)

        print(f"[PAYLOAD] stage={stage.id} substep={session.substep} utterances={session.utterances_this_stage} -> {student_text!r}")

        # log student
        session.events.append(Event(role="student", stage_id=stage.id, text=student_text, ts_ms=now_ms()))

        # intro stage: clarifying loop rule (very simple MVP)
        # If student says "no" (or similar), move on. Otherwise treat as clarifying Q.
        if stage.id == "case_intro":
            eval_out = self._run_evaluation_for_current_stage(session)
            should_advance = bool(eval_out and eval_out.stage_should_advance)
            if eval_out and eval_out.student_attempted_answer and stage.rubric:
                eval_out.evaluation.should_evaluate = True
                hist = self.stage_history(session, stage.id)
                student_last = next((x["text"] for x in reversed(hist) if x["role"] == "student"), None)
                if student_last is not None:
                    session.evaluations.append({
                        "stage_id": stage.id,
                        "substep": session.substep,
                        "scores": eval_out.evaluation.rubric_scores,
                        "notes": eval_out.evaluation.notes_internal,
                        "student_last": student_last,
                    })
            if should_advance:
                session.substep = "DONE"
                self._complete_stage(session, stage)
                pending = self.pop_next_pending_output(session)
                if pending:
                    return pending
                return {"next_action": "ASK", "next_utterance": "Let's move into the case.", "chart_spec": None, "stage_id": stage.id}
            return self._run_question_for_current_stage(session)

        # other stages: evaluate answer, then decide whether to ask another question
        eval_out = self._run_evaluation_for_current_stage(session)
        if eval_out and not eval_out.student_attempted_answer:
            eval_out.stage_should_advance = False

        if eval_out and eval_out.student_attempted_answer and stage.rubric:
            eval_out.evaluation.should_evaluate = True
            hist = self.stage_history(session, stage.id)
            student_last = next((x["text"] for x in reversed(hist) if x["role"] == "student"), None)
            if student_last is not None:
                session.evaluations.append({
                    "stage_id": stage.id,
                    "substep": session.substep,
                    "scores": eval_out.evaluation.rubric_scores,
                    "notes": eval_out.evaluation.notes_internal,
                    "student_last": student_last,
                })

        limit = stage.max_interviewer_turns or 0
        should_ask = not (limit and session.utterances_this_stage >= limit)
        if eval_out and eval_out.stage_should_advance:
            should_ask = False

        out = None
        if should_ask:
            out = self._run_question_for_current_stage(session)

        session.substep = advance_substep(stage, session.substep)
        if out and out.get("stage_done"):
            session.substep = "DONE"
        if not should_ask:
            session.substep = "DONE"

        if session.substep == "DONE":
            self._complete_stage(session, stage)
            pending = self.pop_next_pending_output(session)
            if pending:
                return pending
            return {"next_action": "ASK", "next_utterance": "Proceed.", "chart_spec": None, "stage_id": stage.id}

        return out or {"next_action": "ASK", "next_utterance": "Proceed.", "chart_spec": None, "stage_id": stage.id}

    def _run_evaluation_for_current_stage(self, session: Session) -> Optional[LLMStageEvaluation]:
        stage = self.current_stage(session)
        hist = self.stage_history(session, stage.id)
        if not any(ev["role"] == "student" for ev in hist):
            return None
        ctx = self.case_store.get_stage_context(session.case_id, stage.id)
        payload = build_eval_payload(
            stage_id=stage.id,
            stage_title=stage.title,
            rubric=stage.rubric or [],
            stage_history=hist,
            case_context=ctx,
            stage_guidance=stage.guidance,
        )
        return self.llm.run_json(EVAL_SYSTEM, payload, output_model=LLMStageEvaluation)

    def _run_question_for_current_stage(self, session: Session) -> Dict[str, Any]:
        stage = self.current_stage(session)
        forced_action = None
        if stage.id == "case_intro":
            forced_action = "ANSWER_CLARIFY"
        ctx = self.case_store.get_stage_context(session.case_id, stage.id)
        interviewer_meta = {"name": stage.interviewer_name, "persona": stage.interviewer_persona}
        stage_chart_spec = ctx["stage"].get("chart_spec")
        payload = build_turn_payload(
            stage_id=stage.id,
            stage_title=stage.title,
            allowed_actions=stage.allowed_actions,
            substep=session.substep,
            stage_history=self.stage_history(session, stage.id),
            case_context=ctx,
            interviewer=interviewer_meta,
            stage_guidance=stage.guidance,
            forced_action=forced_action,
        )
        out = self.llm.run_json(TURN_SYSTEM, payload, allowed_actions=stage.allowed_actions, forced_action=forced_action)
        if stage.needs_chart and stage_chart_spec and out.chart_spec is None:
            out.chart_spec = ChartSpec.model_validate(stage_chart_spec)
        if forced_action and out.next_action != forced_action:
            # simplest MVP: override action but keep utterance
            out.next_action = forced_action

        if getattr(out, "stage_feedback_note", None):
            self._record_stage_note(session, stage, out.stage_feedback_note)

        # log interviewer
        session.events.append(Event(
            role="interviewer",
            stage_id=stage.id,
            text=out.next_utterance,
            ts_ms=now_ms(),
            meta={"action": out.next_action, "chart_spec": out.chart_spec.model_dump() if out.chart_spec else None}
        ))
        session.utterances_this_stage += 1
        result = out.model_dump()
        result["stage_id"] = stage.id
        return result

    def _run_feedback(self, session: Session) -> Dict[str, Any]:
        # feedback uses whole interview evals
        case = self.case_store.load_case(session.case_id)
        payload = build_feedback_payload(case["background"], session.evaluations, session.stage_feedback_notes)
        text = self.llm.run_text(FEEDBACK_SYSTEM, payload)
        
        stage = self.current_stage(session)  # end_feedback
        session.events.append(Event(role="interviewer", stage_id=stage.id, text=text, ts_ms=now_ms(), meta={"action": "DELIVER_FEEDBACK"}))

        # end
        closing = "Thanks for your time — that’s the end of the interview."
        session.events.append(Event(role="interviewer", stage_id=stage.id, text=closing, ts_ms=now_ms(), meta={"action": "THANK_AND_CLOSE"}))
        session.stage_index = len(STAGES)  # mark complete
        return {"next_action": "DELIVER_FEEDBACK", "next_utterance": text, "chart_spec": None, "stage_id": stage.id}
