from typing import Dict, Any, List, Tuple

from supabase_client import supabase


def _avg(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _key_order(rubrics: List[Dict[str, Any]], reverse: bool = False) -> List[str]:
    ordered = sorted(rubrics, key=lambda r: r.get("score", 0), reverse=reverse)
    return [r["key"] for r in ordered]


def _infer_track(report: Dict[str, Any]) -> str:
    case_meta = report.get("case", {})
    if case_meta.get("productGroup") or "IB interview" in (case_meta.get("title") or ""):
        return "ib"
    return "consulting"


def save_case_report(user_id: str, report: Dict[str, Any]) -> str:
    if supabase is None:
        raise RuntimeError("Supabase not configured")

    rubrics = report.get("rubrics", [])
    overall_score = _avg([r.get("score", 0) for r in rubrics])
    focus_keys = _key_order(rubrics)[:2]
    high_keys = _key_order(rubrics, reverse=True)[:2]
    case_meta = report["case"]

    # prevent duplicate saves if the report page refreshes
    existing = (
        supabase.table("cases")
        .select("id")
        .eq("user_id", user_id)
        .eq("title", case_meta["title"])
        .eq("completed_at", case_meta["completedAt"])
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    case_payload = {
        "user_id": user_id,
        "title": case_meta["title"],
        "type": case_meta["type"],
        "industry": case_meta["industry"],
        "completed_at": case_meta["completedAt"],
        "duration_sec": case_meta["durationSec"],
        "overall_band": report["overall"]["band"],
        "executive_summary": report["overall"]["executiveSummary"],
        "overall_score": overall_score,
        "focus_keys": focus_keys,
        "high_keys": high_keys,
        "track": _infer_track(report),
        "report_json": report,
    }

    response = supabase.table("cases").insert(case_payload).execute()
    case_id = response.data[0]["id"]

    try:
        for rubric in rubrics:
            supabase.table("case_rubrics").insert({
                "case_id": case_id,
                "user_id": user_id,
                **rubric,
            }).execute()
    except Exception:
        supabase.table("cases").delete().eq("id", case_id).execute()
        raise

    return case_id


def list_cases(user_id: str, limit: int = 10, offset: int = 0) -> Tuple[List[Dict[str, Any]], bool]:
    if supabase is None:
        raise RuntimeError("Supabase not configured")
    start = offset
    end = offset + limit - 1
    resp = (
        supabase.table("cases")
        .select("*, case_rubrics(*)")
        .eq("user_id", user_id)
        .order("completed_at", desc=True)
        .range(start, end)
        .execute()
    )
    cases = []
    for row in resp.data:
        rubrics = row.pop("case_rubrics", [])
        row["rubrics"] = rubrics
        cases.append(row)
    has_more = len(resp.data) == limit
    return cases, has_more


def get_case_report(user_id: str, case_id: str) -> Dict[str, Any]:
    if supabase is None:
        raise RuntimeError("Supabase not configured")
    resp = (
        supabase.table("cases")
        .select("report_json")
        .eq("id", case_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise ValueError("Case not found")
    return resp.data[0]["report_json"]
