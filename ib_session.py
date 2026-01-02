import json
import os
import random
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from llm_client import LLMClient
from prompts import IB_REPORT_SYSTEM, build_ib_report_payload
from schemas import CasePerformanceReport


QUESTION_SYSTEM = """You are Minerva, an expert investment banking interviewer.
You have access to a guide of canonical questions and answers.

For each stage:
- Start from the provided base question and answer.
- Produce exactly one primary question tailored to the product and industry context.
- Keep the tone professional, structured, and grounded in the document.
- Return JSON: {"question": "<primary question>", "adjustment_notes": "<notes on the tweaks>"}.
"""

FOLLOWUP_SYSTEM = """You are continuing an investment banking interview.
You are given:
- The contextual notes used when adapting the primary question.
- The primary question that was asked.
- The student's answer to that primary question.
- The canonical answer from the guide for reference.

Produce exactly one follow-up question that probes deeper and is grounded in the same canonical answer.
Reference specific elements of the student's answer when possible.
Return JSON: {"follow_up": "<question text>"}.
"""

EVAL_SYSTEM = """You are evaluating an investment banking candidate.
You are given:
- The adapted primary question and follow-up.
- The candidate's responses.
- The canonical answer from the guide.
- Notes describing how the primary question was adjusted.

Your job:
1. Score the candidate from 1-5 for this stage.
2. Provide concise feedback referencing the canonical answer and the adjustments. Keep feedback very short (ideally one or two sentences) so it can appear as a brief bullet in the final report.

Return JSON: {"score": int 1-5, "feedback": "<text>"}.
"""


PRODUCT_GUIDES: Dict[str, str] = {
    "M&A": "questions/products/m&a.json",
    "Equity Capital Markets": "questions/products/equity.json",
    "Debt Capital Markets": "questions/products/debt.json",
    "Leveraged Finance": "questions/products/lbo.json",
    "Sales & Trading": "questions/products/sales&trading.json",
    "Restructuring": "questions/products/restructuring.json",
    "Hedge Fund Advisory": "questions/products/hedgefund.json",
}

SECTOR_GUIDES: Dict[str, str] = {
    "Consumer": "questions/sectors/consumer.json",
    "FIG": "questions/sectors/fig.json",
    "Healthcare": "questions/sectors/healthcare.json",
    "Industrials": "questions/sectors/industrials.json",
    "Oil & Gas": "questions/sectors/oilgas.json",
    "Real Estate": "questions/sectors/realestate.json",
    "SaaS": "questions/sectors/saas.json",
    "TMT": "questions/sectors/tmt.json",
}

DEFAULT_ACCOUNTING = "questions/accounting.json"
DEFAULT_VALUATION = "questions/valuation.json"


def _load_guide(path: str) -> List[Dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"Guide at {path} must be a JSON list.")
    return data


def _choose_entry(entries: List[Dict], used: set) -> Dict:
    pool = [e for e in entries if e.get("id", e.get("question")) not in used]
    if not pool:
        raise RuntimeError("Ran out of unique questions in the guide.")
    return random.choice(pool)


@dataclass
class IBStage:
    id: str
    title: str
    agent: str
    entries: List[Dict]
    used_ids: set = field(default_factory=set)


class IBInterviewSession:
    def __init__(
        self,
        *,
        llm_client: LLMClient,
        product_group: str,
        industry_group: str,
        accounting_guide: str = DEFAULT_ACCOUNTING,
        valuation_guide: str = DEFAULT_VALUATION,
    ):
        if product_group not in PRODUCT_GUIDES:
            raise ValueError(f"Unknown product group '{product_group}'.")
        if industry_group not in SECTOR_GUIDES:
            raise ValueError(f"Unknown industry group '{industry_group}'.")

        self.llm = llm_client
        self.product_group = product_group
        self.industry_group = industry_group
        self.started_at_ms: Optional[int] = None
        self.completed_at_ms: Optional[int] = None
        self.report_data: Optional[Dict[str, Any]] = None

        self.stages: List[IBStage] = [
            IBStage("accounting", "Accounting Fundamentals", "Lena (Accounting VP)", _load_guide(accounting_guide)),
            IBStage("valuation", "Valuation Basics", "Marco (Valuation Specialist)", _load_guide(valuation_guide)),
            IBStage("product", "Product Group Specifics", "Priya (Product Lead)", _load_guide(PRODUCT_GUIDES[product_group])),
            IBStage("sector", "Industry Nuances", "Noah (Industry Partner)", _load_guide(SECTOR_GUIDES[industry_group])),
        ]

        self.stage_index = 0
        self.substate = "initial"  # primary, followup, done
        self.previous_answer = ""
        self.current_stage_state: Optional[Dict] = None
        self.events: List[Dict] = []
        self.evaluations: List[Dict] = []
        self.case_title = f"{industry_group} · {product_group} IB interview"

    # ---- public API ----
    def start(self) -> str:
        if self.started_at_ms is None:
            self.started_at_ms = self._now_ms()
        question = self._start_stage()
        return question

    def step(self, student_text: str) -> Tuple[str, bool]:
        if self.substate not in {"primary", "followup"}:
            raise RuntimeError("Interview is already complete or not started.")

        stage_state = self.current_stage_state or {}
        stage = stage_state.get("stage")

        self._record_event("student", student_text, stage.id if stage else "unknown")

        if self.substate == "primary":
            stage_state["student_primary_answer"] = student_text
            follow_up = self._generate_followup(stage_state)
            stage_state["follow_up_question"] = follow_up
            self.substate = "followup"
            self._record_event("interviewer", follow_up, stage.id)
            return follow_up, False

        # follow-up
        stage_state["student_follow_answer"] = student_text
        evaluation = self._evaluate_stage(stage_state)
        self.evaluations.append(
            {
                "stage_id": stage_state["stage"].id,
                "stage_title": stage_state["stage"].title,
                "score": evaluation.get("score"),
                "feedback": evaluation.get("feedback"),
            }
        )

        self.previous_answer = student_text
        self.stage_index += 1

        if self.stage_index >= len(self.stages):
            self.substate = "done"
            if self.completed_at_ms is None:
                self.completed_at_ms = self._now_ms()
            self.report_data = self._build_report_dict()
            return "", True

        question = self._start_stage()
        return question, False

    def serialize_events(self) -> List[Dict]:
        return list(self.events)

    # ---- helpers ----
    def _start_stage(self) -> str:
        stage = self.stages[self.stage_index]
        entry = _choose_entry(stage.entries, stage.used_ids)
        stage.used_ids.add(entry.get("id", entry["question"]))

        payload = {
            "base_question": entry["question"],
            "base_answer": entry["answer"],
            "product_group": self.product_group,
            "industry_group": self.industry_group,
            "student_previous_answer": self.previous_answer or "N/A",
            "interviewer": stage.agent,
            "stage_title": stage.title,
        }
        question_text = self.llm.run_text(QUESTION_SYSTEM, payload)
        try:
            question_data = json.loads(question_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"LLM question output invalid JSON: {question_text}") from exc

        primary = question_data.get("question")
        adjustments = question_data.get("adjustment_notes", "")
        if not primary:
            raise RuntimeError("LLM failed to return a primary question.")

        self.current_stage_state = {
            "stage": stage,
            "entry": entry,
            "question": primary,
            "adjustment_notes": adjustments,
        }
        self.substate = "primary"
        self._record_event("interviewer", primary, stage.id)
        return primary

    def _generate_followup(self, stage_state: Dict) -> str:
        payload = {
            "primary_question": stage_state["question"],
            "student_primary_answer": stage_state["student_primary_answer"],
            "reference_answer": stage_state["entry"]["answer"],
            "adjustment_notes": stage_state["adjustment_notes"],
            "product_group": self.product_group,
            "industry_group": self.industry_group,
        }
        follow_text = self.llm.run_text(FOLLOWUP_SYSTEM, payload)
        try:
            data = json.loads(follow_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"LLM follow-up output invalid JSON: {follow_text}") from exc
        follow_up = data.get("follow_up")
        if not follow_up:
            raise RuntimeError("LLM follow-up output missing question.")
        return follow_up

    def _evaluate_stage(self, stage_state: Dict) -> Dict:
        payload = {
            "question": stage_state["question"],
            "follow_up": stage_state["follow_up_question"],
            "student_primary_answer": stage_state["student_primary_answer"],
            "student_follow_up_answer": stage_state["student_follow_answer"],
            "reference_answer": stage_state["entry"]["answer"],
            "adjustment_notes": stage_state["adjustment_notes"],
            "stage_title": stage_state["stage"].title,
        }
        evaluation_text = self.llm.run_text(EVAL_SYSTEM, payload)
        try:
            data = json.loads(evaluation_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"LLM evaluation output invalid JSON: {evaluation_text}") from exc
        return data

    def _build_summary(self) -> str:
        lines = ["Thank you. Here's your investment banking interview summary:"]
        for ev in self.evaluations:
            lines.append(f"- {ev['stage_title']}: {ev.get('score', 'N/A')}/5. {ev.get('feedback', '').strip()}")
        return "\n".join(lines)

    def _record_event(self, role: str, text: str, stage_id: str) -> None:
        self.events.append({
            "role": role,
            "stage_id": stage_id,
            "text": text,
        })

    def get_report(self) -> Optional[Dict[str, Any]]:
        return self.report_data

    # ---- report helpers ----
    def _build_report_dict(self) -> Dict[str, Any]:
        completed_ms = self.completed_at_ms or self._now_ms()
        start_ms = self.started_at_ms or completed_ms
        duration_sec = max(1, int((completed_ms - start_ms) / 1000))
        completed_at = datetime.fromtimestamp(completed_ms / 1000).strftime("%b %d, %Y %I:%M %p")
        case_meta = {
            "title": self.case_title,
            "type": self.product_group,
            "productGroup": self.product_group,
            "industry": self.industry_group,
            "completedAt": completed_at,
            "durationSec": duration_sec,
        }
        stage_rows = []
        for idx, ev in enumerate(self.evaluations):
            score = ev.get("score")
            try:
                score_val = float(score)
            except (TypeError, ValueError):
                score_val = 0.0
            stage_rows.append(
                {
                    "id": ev.get("stage_id") or f"stage_{idx}",
                    "title": ev.get("stage_title") or f"Stage {idx + 1}",
                    "score": round(score_val, 1),
                    "feedback": ev.get("feedback") or "No feedback captured.",
                }
            )

        scores = [row["score"] for row in stage_rows if isinstance(row["score"], (int, float))]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        band = self._score_to_band(avg_score)

        if not stage_rows:
            return self._manual_report(case_meta, band, avg_score, stage_rows)

        payload = build_ib_report_payload(
            case_meta=case_meta,
            average_score=avg_score,
            suggested_band=band,
            stages=stage_rows,
        )
        try:
            report = self.llm.run_json(
                IB_REPORT_SYSTEM, payload, output_model=CasePerformanceReport
            )
            data = report.model_dump()
            data["case"] = case_meta
            data["overall"]["band"] = band
            data["overall"]["averageScore"] = avg_score
            return data
        except Exception:
            return self._manual_report(case_meta, band, avg_score, stage_rows)

    def _manual_report(
        self,
        case_meta: Dict[str, Any],
        band: str,
        avg_score: float,
        stage_rows: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        summary = self._build_exec_summary()
        rubrics = []
        for idx, stage in enumerate(stage_rows):
            feedback = stage.get("feedback") or "No feedback captured."
            score_val = stage.get("score") or 0.0
            title = stage.get("title") or f"Stage {idx + 1}"
            key = stage.get("id") or f"stage_{idx}"
            if score_val >= 4:
                strengths = [{"text": feedback}]
                improvements = [{"text": "Keep pushing depth to stand out further."}]
            elif score_val >= 3:
                strengths = [{"text": "Solid foundation demonstrated."}]
                improvements = [{"text": feedback}]
            else:
                strengths = [{"text": "No notable strength captured."}]
                improvements = [{"text": feedback}]
            rubrics.append(
                {
                    "key": key,
                    "title": title,
                    "score": round(score_val, 1),
                    "strengths": strengths,
                    "improvements": improvements,
                }
            )

        if not rubrics:
            rubrics.append(
                {
                    "key": "overall",
                    "title": "Overall interview",
                    "score": 0.0,
                    "strengths": [{"text": "No notable strength captured."}],
                    "improvements": [{"text": summary or "No improvement noted."}],
                }
            )

        return {
            "case": case_meta,
            "overall": {
                "band": band,
                "executiveSummary": summary,
                "averageScore": avg_score,
            },
            "rubrics": rubrics,
        }

    def _build_exec_summary(self) -> str:
        if not self.evaluations:
            return "Interview feedback is not available yet."
        scored = [ev for ev in self.evaluations if isinstance(ev.get("score"), (int, float))]
        if not scored:
            return "Interview feedback is not available yet."
        best = max(scored, key=lambda ev: ev.get("score", 0))
        worst = min(scored, key=lambda ev: ev.get("score", 0))
        if best is worst:
            base = f"Overall performance on {best['stage_title']} was scored {best.get('score', 'N/A')}/5."
            feedback = best.get("feedback", "").strip()
            return f"{base} {feedback}".strip()
        focus_text = worst.get("feedback", "").strip()
        summary = (
            f"Strongest area: {best['stage_title']} ({best.get('score', 'N/A')}/5). "
            f"Focus next on {worst['stage_title']} ({worst.get('score', 'N/A')}/5)."
        )
        if focus_text:
            summary = f"{summary} {focus_text}"
        return summary

    @staticmethod
    def _score_to_band(score: float) -> str:
        if score >= 4.0:
            return "Strong"
        if score >= 3.0:
            return "Solid"
        if score >= 2.0:
            return "Developing"
        return "Needs work"

    @staticmethod
    def _now_ms() -> int:
        return int(time.time() * 1000)
