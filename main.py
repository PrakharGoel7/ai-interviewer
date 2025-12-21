import os
import argparse
from openai import OpenAI

from case_store import CaseStore
from llm_client import LLMClient
from controller import Session, InterviewController
from case_generator import generate_case
from stages import STAGES
from voice import create_voice_interface
from chart_renderer import render_chart


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--theme", default="pricing for a SaaS product")
    parser.add_argument("--difficulty", default="medium")
    parser.add_argument("--voice_max_seconds", type=int, default=12)
    args = parser.parse_args()

    def display_turn(turn: dict) -> None:
        if not turn:
            return
        if turn.get("chart_spec"):
            print("\n[CHART_SPEC]:", turn["chart_spec"])
            render_chart(turn["chart_spec"])
        print("\nINTERVIEWER:", turn["next_utterance"])
        voice.speak(turn["next_utterance"])

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
    voice = create_voice_interface(client, max_seconds=args.voice_max_seconds)

    # Always begin from the case intro and proceed sequentially.
    out = controller.start(session)  # reads case + asks for clarifying questions

    display_turn(out)
    for pending in controller.flush_pending_outputs(session):
        display_turn(pending)

    # --- loop ---
    while session.stage_index < len(STAGES):
        user = voice.listen()
        print(f"[STT] {user!r}")
        if not user:
            continue

        out = controller.step(session, user)

        display_turn(out)
        for pending in controller.flush_pending_outputs(session):
            display_turn(pending)

    print("\n--- Interview complete ---")


if __name__ == "__main__":
    main()
