import os
import base64
import tempfile
from typing import List, Dict, Any

from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI

from case_store import CaseStore
from controller import Session, InterviewController
from llm_client import LLMClient
from case_generator import generate_case

app = Flask(__name__, static_folder="frontend", static_url_path="")

client = OpenAI()
llm = LLMClient(client=client, model=os.getenv("MODEL", "gpt-4.1"))
case_store = CaseStore()
controller = InterviewController(
    case_store=case_store,
    llm_client=llm,
    case_generator_fn=lambda: generate_case(llm),
)
session = Session(case_id="web_session_case")


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


@app.route("/api/start", methods=["POST"])
def api_start():
    global session
    session = Session(case_id="web_session_case")
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


if __name__ == "__main__":
    app.run(debug=True)
