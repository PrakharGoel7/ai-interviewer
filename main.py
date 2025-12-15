import os
import argparse
from openai import OpenAI

from case_store import CaseStore
from llm_client import LLMClient
from controller import Session, InterviewController
from case_generator import generate_case
from stages import STAGES


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--start_stage",
        default="case_intro",
        help="Stage id: case_intro | structuring | chart | math | creative | end_feedback",
    )
    parser.add_argument(
        "--substep",
        default="START",
        help="Substep: START | PRIMARY_ASKED | PROBE_ASKED",
    )
    parser.add_argument("--theme", default="pricing for a SaaS product")
    parser.add_argument("--difficulty", default="medium")
    args = parser.parse_args()

    # --- setup deps ---
    client = OpenAI()
    llm = LLMClient(client=client, model=os.getenv("MODEL", "gpt-4.1"))
    case_store = CaseStore()

    controller = InterviewController(
        case_store=case_store,
        llm_client=llm,
        case_generator_fn=lambda: generate_case(llm, case_theme=args.theme, difficulty=args.difficulty),
    )

    session = Session(case_id="session_case_001")

    # --- validate args ---
    valid_stage_ids = [s.id for s in STAGES]
    if args.start_stage not in valid_stage_ids:
        raise SystemExit(f"--start_stage must be one of: {', '.join(valid_stage_ids)}")

    valid_substeps = {"START", "PRIMARY_ASKED", "PROBE_ASKED"}
    if args.substep not in valid_substeps:
        raise SystemExit(f"--substep must be one of: {', '.join(sorted(valid_substeps))}")

    # --- start: normal path vs debug jump ---
    if args.start_stage == "case_intro" and args.substep == "START":
        out = controller.start(session)  # reads case + asks for clarifying questions
    else:
        controller.debug_set_position(session, stage_id=args.start_stage, substep=args.substep)
        out = controller.emit_current_prompt(session)  # deterministic ask/chart display

    print("\nINTERVIEWER:", out["next_utterance"])
    if out.get("chart_spec"):
        print("\n[CHART_SPEC]:", out["chart_spec"])

    # --- loop ---
    while session.stage_index < len(STAGES):
        user = input("\nYOU: ").strip()
        if not user:
            continue

        out = controller.step(session, user)

        if out.get("chart_spec"):
            print("\n[CHART_SPEC]:", out["chart_spec"])
        print("\nINTERVIEWER:", out["next_utterance"])

    print("\n--- Interview complete ---")


if __name__ == "__main__":
    main()