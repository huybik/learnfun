"""API package — all FastAPI routers with prefix /api."""

from fastapi import APIRouter

from server.api.auth import router as auth_router
from server.api.bundles import router as bundles_router
from server.api.events import router as events_router
from server.api.health import router as health_router
from server.api.join import router as join_router
from server.api.scores import router as scores_router
from server.api.session import router as session_router
from server.api.ta import router as ta_router
from server.api.teacher import router as teacher_router
from server.api.token import router as token_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(session_router)
api_router.include_router(join_router)
api_router.include_router(health_router)
api_router.include_router(token_router)
api_router.include_router(bundles_router)
api_router.include_router(events_router)
api_router.include_router(scores_router)
api_router.include_router(ta_router)
api_router.include_router(teacher_router)
