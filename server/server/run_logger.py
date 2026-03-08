"""Run logger — writes AI prompts/responses to runs/<start_ts>/<session_id[:6]>/."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from server.config import settings

_ROOT_DIR = Path(settings.DATA_DIR).resolve().parent
RUNS_DIR = _ROOT_DIR / "runs"

# Cache session start timestamps: session_id -> timestamp string
_session_starts: dict[str, str] = {}


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _serialize(data: Any) -> str:
    if isinstance(data, str):
        return data
    try:
        return json.dumps(data, indent=2, default=str, ensure_ascii=False)
    except Exception:
        return str(data)


def _ts() -> str:
    return time.strftime("%Y%m%d_%H%M%S")


def _session_dir(session_id: str) -> Path:
    """Get or create the session directory using the start timestamp."""
    if session_id not in _session_starts:
        _session_starts[session_id] = _ts()
    return RUNS_DIR / _session_starts[session_id] / session_id[:6]


def log_ta_run(session_id: str, prompt: str, response: Any) -> None:
    """Log a TA (Gemini Flash) prompt and response."""
    ts = _ts()
    d = _ensure_dir(_session_dir(session_id) / "ai-ta")
    (d / f"{ts}_prompt.txt").write_text(prompt, encoding="utf-8")
    (d / f"{ts}_response.json").write_text(_serialize(response), encoding="utf-8")


def log_ta_error(session_id: str, error: str, context: Any) -> None:
    """Log a TA generation error."""
    ts = _ts()
    d = _ensure_dir(_session_dir(session_id) / "ai-ta")
    entry = {"ts": ts, "error": error, **context} if isinstance(context, dict) else {"ts": ts, "error": error, "context": context}
    (d / f"{ts}_error.json").write_text(_serialize(entry), encoding="utf-8")


def log_teacher_prompt(session_id: str, prompt: str, metadata: Any) -> None:
    """Log the Teacher system prompt (called once at session start)."""
    ts = _ts()
    d = _ensure_dir(_session_dir(session_id) / "ai-teacher")
    (d / f"{ts}_prompt.txt").write_text(prompt, encoding="utf-8")
    (d / f"{ts}_metadata.json").write_text(_serialize(metadata), encoding="utf-8")


def log_teacher_event(session_id: str, event_type: str, data: Any) -> None:
    """Append a Teacher event (tool call, transcription, usage) to events.jsonl."""
    d = _ensure_dir(_session_dir(session_id) / "ai-teacher")
    entry = json.dumps(
        {"ts": _ts(), "type": event_type, "data": data},
        default=str,
        ensure_ascii=False,
    )
    with open(d / "events.jsonl", "a", encoding="utf-8") as f:
        f.write(entry + "\n")
