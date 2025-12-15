from typing import Dict, Any

class CaseStore:
    def __init__(self):
        self._cases: Dict[str, Dict[str, Any]] = {}

    def put_case(self, case_id: str, case_obj: Dict[str, Any]) -> None:
        self._cases[case_id] = case_obj

    def load_case(self, case_id: str) -> Dict[str, Any]:
        if case_id not in self._cases:
            raise KeyError(f"Case '{case_id}' not found.")
        return self._cases[case_id]

    def get_stage_context(self, case_id: str, stage_id: str) -> Dict[str, Any]:
        case = self.load_case(case_id)
        if stage_id not in case["stages"]:
            raise KeyError(f"Stage '{stage_id}' not found in case '{case_id}'")
        return {
            "case_id": case_id,
            "background": case["background"],
            "stage": case["stages"][stage_id],
        }