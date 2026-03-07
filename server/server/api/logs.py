"""POST /api/logs — receive browser logs and write to structured log output."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from server.logging import get_logger

router = APIRouter()

# Cache loggers per client module to avoid re-creation
_loggers: dict[str, Any] = {}


def _get_fe_logger(module: str) -> Any:
    key = f"fe:{module}"
    if key not in _loggers:
        _loggers[key] = get_logger(key)
    return _loggers[key]


@router.post("/logs")
async def post_logs(request: Request):
    try:
        body = await request.json()
        entries: list[dict[str, Any]] = body if isinstance(body, list) else [body]

        for entry in entries:
            module = entry.get("module", "unknown")
            msg = entry.get("msg", "")
            level = entry.get("level", "info")

            # Strip known meta keys, pass the rest as structured context
            extra = {k: v for k, v in entry.items() if k not in ("ts", "level", "module", "msg")}

            logger = _get_fe_logger(module)
            getattr(logger, level, logger.info)(msg, **extra)

        return {"ok": True}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log data")
