"""POST /api/logs — receive browser logs and write to structured log output."""

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from server.logging import get_logger

log = get_logger("api:logs")
browser_log = get_logger("browser")
router = APIRouter()


@router.post("/logs")
async def post_logs(request: Request):
    try:
        body = await request.json()
        entries: list[dict[str, Any]] = body if isinstance(body, list) else [body]

        for entry in entries:
            level = entry.get("level", "info")
            args = entry.get("args", [])
            ts = entry.get("ts", datetime.now(timezone.utc).isoformat())

            # Detect structured log entries (have module + msg keys)
            first_arg = args[0] if args else None
            is_structured = (
                len(args) == 1
                and isinstance(first_arg, dict)
                and "module" in first_arg
                and "msg" in first_arg
            )

            if is_structured:
                browser_log.info(
                    first_arg.get("msg", ""),
                    **{k: v for k, v in first_arg.items() if k not in ("msg",)},
                )
            else:
                msg = " ".join(
                    a if isinstance(a, str) else json.dumps(a, default=str)
                    for a in args
                )
                browser_log.info(msg, ts=ts, level=level)

        return {"ok": True}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log data")
