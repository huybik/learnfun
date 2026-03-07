"""Run logger — writes AI prompts and responses to runs/<timestamp>/<session_id[:6]>/."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from server.config import settings

_ROOT_DIR = Path(settings.DATA_DIR).resolve().parent.parent
RUNS_DIR = _ROOT_DIR / "runs"


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _run_dir(session_id: str) -> Path:
    ts = time.strftime("%Y%m%d_%H%M%S")
    return RUNS_DIR / ts / session_id[:6]


def _serialize(data: Any) -> str:
    if isinstance(data, str):
        return data
    try:
        return json.dumps(data, indent=2, default=str, ensure_ascii=False)
    except Exception:
        return str(data)


def log_ta_run(session_id: str, prompt: str, response: Any) -> None:
    """Log a TA (Gemini Flash) prompt and response."""
    d = _ensure_dir(_run_dir(session_id) / "ai-ta")
    (d / "prompt.txt").write_text(prompt, encoding="utf-8")
    (d / "response.json").write_text(_serialize(response), encoding="utf-8")


def log_teacher_run(session_id: str, prompt: str, response: Any) -> None:
    """Log a Teacher (Gemini Live) prompt and response."""
    d = _ensure_dir(_run_dir(session_id) / "ai-teacher")
    (d / "prompt.txt").write_text(prompt, encoding="utf-8")
    (d / "response.json").write_text(_serialize(response), encoding="utf-8")
