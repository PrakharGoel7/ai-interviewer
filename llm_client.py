import json
from typing import Any, Dict
from schemas import LLMTurnOutput

class LLMClient:
    def __init__(self, client, model: str):
        self.client = client
        self.model = model

    def run_json(self, system_prompt: str, payload: Dict[str, Any]) -> LLMTurnOutput:
        # Uses OpenAI Responses API style; adapt if you use ChatCompletions.
        resp = self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload)}
            ],
            # If your SDK supports JSON schema enforcement, use it.
        )
        text = resp.output_text.strip()
        data = json.loads(text)
        return LLMTurnOutput.model_validate(data)

    def run_text(self, system_prompt: str, payload: Dict[str, Any]) -> str:
        resp = self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload)}
            ],
        )
        return resp.output_text.strip()