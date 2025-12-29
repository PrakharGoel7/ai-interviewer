import argparse
import os

from openai import OpenAI

from ib_session import IBInterviewSession, PRODUCT_GUIDES, SECTOR_GUIDES
from llm_client import LLMClient


def run_cli(args):
    client = OpenAI()
    llm = LLMClient(client=client, model=os.getenv("MODEL", "gpt-4.1"))

    session = IBInterviewSession(
        llm_client=llm,
        product_group=args.product_group,
        industry_group=args.industry_group,
        accounting_guide=args.accounting_guide,
        valuation_guide=args.valuation_guide,
    )

    question = session.start()
    print("\n" + question)

    done = False
    while not done:
        user = input("\nYour answer: ").strip()
        if not user:
            continue
        reply, done = session.step(user)
        print("\n" + reply)

    print("\nInterview complete. Summary:")
    for ev in session.evaluations:
        print(f"{ev['stage_title']}: {ev.get('score', 'N/A')}/5 — {ev.get('feedback', '')}")


def main():
    parser = argparse.ArgumentParser(description="CLI investment banking interviewer")
    parser.add_argument("--accounting-guide", default="questions/accounting.json")
    parser.add_argument("--valuation-guide", default="questions/valuation.json")
    parser.add_argument("--product-group", required=True, choices=sorted(PRODUCT_GUIDES.keys()))
    parser.add_argument("--industry-group", required=True, choices=sorted(SECTOR_GUIDES.keys()))
    args = parser.parse_args()
    run_cli(args)


if __name__ == "__main__":
    main()
