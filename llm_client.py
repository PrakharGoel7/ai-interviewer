import json
from typing import Any, Dict
from schemas import LLMTurnOutput

class LLMClient:
    def __init__(self, client, model: str):
        self.client = client
        self.model = model

    def run_json(self, system_prompt: str, payload: Dict[str, Any], *, allowed_actions=None, forced_action=None, output_model=LLMTurnOutput):
        print("\n" + "="*80)
        print("🤖 LLM CALL (JSON)")
        print("- Model:", self.model)
        print("- System prompt:")
        print(system_prompt)
        print("- User payload:")
        print(json.dumps(payload, indent=2))
        print("="*80)

        resp = self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload)}
            ],
        )

        text = resp.output_text.strip()

        print("\n" + "-"*80)
        print("🧠 LLM RAW OUTPUT")
        print(text)
        print("-"*80)

        data = json.loads(text)
        allowed_actions = allowed_actions or payload.get("allowed_actions") or []
        forced_action = forced_action or payload.get("forced_action")
        allowed_set = set(allowed_actions)
        if forced_action:
            allowed_set.add(forced_action)

        next_action = data.get("next_action")
        if allowed_set and next_action not in allowed_set:
            fallback = forced_action or next(iter(allowed_actions), None)
            if fallback is None:
                raise ValueError("LLM returned invalid action and no fallback is available.")
            print(f"⚠️  Invalid next_action '{next_action}' from LLM; falling back to '{fallback}'.")
            data["next_action"] = fallback

        return output_model.model_validate(data)

    def run_text(self, system_prompt: str, payload: Dict[str, Any]) -> str:
        print("\n" + "="*80)
        print("🤖 LLM CALL (TEXT / FEEDBACK)")
        print("- Model:", self.model)
        print("- System prompt:")
        print(system_prompt)
        print("- User payload:")
        print(json.dumps(payload, indent=2))
        print("="*80)

        resp = self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload)}
            ],
        )

        text = resp.output_text.strip()

        print("\n" + "-"*80)
        print("🧠 LLM FEEDBACK OUTPUT")
        print(text)
        print("-"*80)

        return text
