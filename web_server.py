import os
import base64
import tempfile
from typing import List, Dict, Any, Optional

from flask import Flask, jsonify, request, send_from_directory
from supabase_client import supabase
from persistence import save_case_report, list_cases, get_case_report
from openai import OpenAI

from case_store import CaseStore
from controller import Session, InterviewController
from llm_client import LLMClient
from case_generator import generate_case, CONSULTING_CASE_TYPES
from ib_session import (
    IBInterviewSession,
    PRODUCT_GUIDES,
    SECTOR_GUIDES,
    DEFAULT_ACCOUNTING,
    DEFAULT_VALUATION,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIST = os.path.join(BASE_DIR, "web", "dist")

app = Flask(__name__, static_folder="frontend", static_url_path="")

client = OpenAI()
llm = LLMClient(client=client, model=os.getenv("MODEL", "gpt-4.1"))
case_store = CaseStore()
DEFAULT_CASE_TYPE = "Profitability"


def controller_case_generator(**params):
    requested_case_type = params.get("case_type") or DEFAULT_CASE_TYPE
    return generate_case(llm, case_type=requested_case_type)


controller = InterviewController(
    case_store=case_store,
    llm_client=llm,
    case_generator_fn=controller_case_generator,
)
session = Session(case_id="web_session_case")
ib_session: Optional[IBInterviewSession] = None
ib_report: Optional[Dict[str, Any]] = None


def serialize_events(events: List[Any]) -> List[Dict[str, Any]]:
    return [
        {
            "role": e.role,
            "stage_id": e.stage_id,
            "text": e.text,
            "ts_ms": e.ts_ms,
            "action": e.meta.get("action"),
            "chart_spec": e.meta.get("chart_spec"),
        }
        for e in events
    ]


def serialize_turn(turn: Dict[str, Any]) -> Dict[str, Any]:
    if not turn:
        return {}
    return {
        "next_action": turn.get("next_action"),
        "next_utterance": turn.get("next_utterance"),
        "chart_spec": turn.get("chart_spec"),
        "stage_id": turn.get("stage_id"),
    }


def take_turns(first_turn: Dict[str, Any]) -> List[Dict[str, Any]]:
    turns = []
    if first_turn:
        turns.append(first_turn)
    for pending in controller.flush_pending_outputs(session):
        turns.append(pending)
    return [serialize_turn(t) for t in turns if t]


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/report")
@app.route("/report.html")
def report_page():
    return send_from_directory(app.static_folder, "report.html")


def _react_app_available() -> bool:
    return os.path.exists(os.path.join(WEB_APP_DIST, "index.html"))


def _require_supabase_user():
    if supabase is None:
        return None, jsonify({"error": "Supabase not configured"}), 500
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, jsonify({"error": "missing bearer token"}), 401
    access_token = auth_header.split(" ", 1)[1]
    try:
        user_resp = supabase.auth.get_user(access_token)
    except Exception as exc:
        app.logger.warning("Supabase auth failed: %s", exc)
        return None, jsonify({"error": "invalid token"}), 401
    user = getattr(user_resp, "user", None)
    if not user:
        return None, jsonify({"error": "invalid token"}), 401
    return user, None, None


@app.route("/app/", defaults={"path": ""})
@app.route("/app/<path:path>")
def dashboard_app(path: str):
    """
    Serve the bundled React dashboard from /web/dist once built.
    """
    if not _react_app_available():
        return jsonify({"error": "dashboard not built"}), 404
    asset_path = os.path.join(WEB_APP_DIST, path)
    if path and os.path.exists(asset_path) and os.path.isfile(asset_path):
        return send_from_directory(WEB_APP_DIST, path)
    return send_from_directory(WEB_APP_DIST, "index.html")


@app.route("/api/start", methods=["POST"])
def api_start():
    global session
    data = request.get_json(silent=True) or {}
    case_type = data.get("case_type")
    firm = data.get("firm")
    if case_type and case_type not in CONSULTING_CASE_TYPES:
        return jsonify({"error": "invalid case_type"}), 400
    chosen_case_type = case_type if case_type in CONSULTING_CASE_TYPES else DEFAULT_CASE_TYPE
    session = Session(case_id="web_session_case")
    session.case_params["case_type"] = chosen_case_type
    session.selected_firm = firm
    out = controller.start(session)
    return jsonify(
        {
            "events": serialize_events(session.events),
            "turns": take_turns(out),
        }
    )


@app.route("/api/respond", methods=["POST"])
def api_respond():
    data = request.get_json(force=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    turn = controller.step(session, text)
    return jsonify({"events": serialize_events(session.events), "turns": take_turns(turn)})


@app.route("/api/state", methods=["GET"])
def api_state():
    return jsonify({"events": serialize_events(session.events)})


@app.route("/api/report", methods=["GET"])
def api_report():
    if not session.case_report:
        return jsonify({"error": "report not ready"}), 404
    return jsonify(session.case_report)


@app.route("/api/ib/report", methods=["GET"])
def api_ib_report():
    if not ib_report:
        return jsonify({"error": "report not ready"}), 404
    return jsonify(ib_report)


@app.route("/api/cases/save", methods=["POST"])
def api_save_case():
    user, err_resp, status = _require_supabase_user()
    if err_resp:
        return err_resp, status

    data = request.get_json(force=True) or {}
    report = data.get("report")
    if not report:
        return jsonify({"error": "report required"}), 400
    try:
        case_id = save_case_report(user.id, report)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"caseId": case_id})


@app.route("/api/cases/<case_id>", methods=["GET"])
def api_case_detail(case_id: str):
    user, err_resp, status = _require_supabase_user()
    if err_resp:
        return err_resp, status

    try:
        report = get_case_report(user.id, case_id)
    except ValueError:
        return jsonify({"error": "not found"}), 404
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"report": report})


@app.route("/api/cases", methods=["GET"])
def api_cases_list():
    user, err_resp, status = _require_supabase_user()
    if err_resp:
        return err_resp, status

    limit = int(request.args.get("limit", 10))
    page = int(request.args.get("page", 0))
    offset = page * limit
    try:
        data, has_more = list_cases(user.id, limit=limit, offset=offset)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"cases": data, "hasMore": has_more})


@app.route("/api/tts", methods=["POST"])
def api_tts():
    data = request.get_json(force=True) or {}
    text = data.get("text", "").strip()
    voice = data.get("voice", "alloy")
    if not text:
        return jsonify({"error": "text required"}), 400
    resp = client.audio.speech.create(
        model=os.getenv("VOICE_MODEL", "gpt-4o-mini-tts"),
        voice=voice,
        input=text,
    )
    audio_bytes = resp.read()
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    return jsonify({"audio_base64": audio_b64, "mime": "audio/mpeg"})


@app.route("/api/transcribe", methods=["POST"])
def api_transcribe():
    audio = request.files.get("audio")
    if not audio:
        return jsonify({"error": "audio file required"}), 400
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            audio.save(tmp)
            tmp_path = tmp.name
        with open(tmp_path, "rb") as f:
            resp = client.audio.transcriptions.create(
                model=os.getenv("STT_MODEL", "gpt-4o-mini-transcribe"),
                file=f,
            )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
    text = getattr(resp, "text", "").strip()
    return jsonify({"text": text})


@app.route("/api/ib/start", methods=["POST"])
def api_ib_start():
    global ib_report
    data = request.get_json(force=True) or {}
    product = data.get("product_group")
    industry = data.get("industry_group")
    if product not in PRODUCT_GUIDES or industry not in SECTOR_GUIDES:
        return jsonify({"error": "invalid product or industry group"}), 400
    accounting_guide = data.get("accounting_guide", DEFAULT_ACCOUNTING)
    valuation_guide = data.get("valuation_guide", DEFAULT_VALUATION)

    try:
        session_obj = IBInterviewSession(
            llm_client=llm,
            product_group=product,
            industry_group=industry,
            accounting_guide=accounting_guide,
            valuation_guide=valuation_guide,
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    question = session_obj.start()
    global ib_session
    ib_session = session_obj
    ib_report = None
    return jsonify(
        {
            "events": session_obj.serialize_events(),
            "turns": [{"next_utterance": question, "stage_id": session_obj.current_stage_state["stage"].id}],
            "done": False,
        }
    )


@app.route("/api/ib/respond", methods=["POST"])
def api_ib_respond():
    global ib_session, ib_report
    if ib_session is None:
        return jsonify({"error": "session not started"}), 400
    data = request.get_json(force=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    try:
        reply, done = ib_session.step(text)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400
    stage_id = "summary"
    if not done and ib_session.current_stage_state:
        stage_id = ib_session.current_stage_state["stage"].id
    if done:
        ib_report = ib_session.get_report()
    return jsonify(
        {
            "events": ib_session.serialize_events(),
            "turns": [{"next_utterance": reply, "stage_id": stage_id}],
            "done": done,
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
