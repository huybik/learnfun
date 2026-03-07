"""GET /api/health — system health check."""

from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from server.events.redis_bridge import redis_bridge
from server.logging import get_logger

from .session_manager import get_active_session_count

log = get_logger("api:health")
router = APIRouter()


@router.get("/health")
async def get_health():
    checks: dict[str, dict] = {}

    # Redis connectivity
    try:
        if redis_bridge._redis is not None:
            await redis_bridge._redis.ping()
            checks["redis"] = {"status": "up"}
        else:
            checks["redis"] = {"status": "down", "detail": "Not connected"}
    except Exception:
        checks["redis"] = {"status": "down", "detail": "Ping failed"}

    # Session store
    active = get_active_session_count()
    checks["sessions"] = {"status": "up", "detail": f"{active} active"}

    all_up = all(c["status"] == "up" for c in checks.values())

    log.debug("Health check", checks=checks, overall="healthy" if all_up else "degraded")

    return JSONResponse(
        content={
            "status": "healthy" if all_up else "degraded",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": checks,
        },
        status_code=200 if all_up else 503,
    )
