"""POST /api/join — join an existing session."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.logging import get_logger

from .room_manager import join_session

log = get_logger("api:join")
router = APIRouter()


class JoinSessionRequest(BaseModel):
    sessionId: str
    userName: str


@router.post("/join")
async def post_join(body: JoinSessionRequest):
    try:
        result = await join_session(body.sessionId, body.userName)
        log.info("User joined session via API", session_id=body.sessionId, user_name=body.userName)
        return result
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        if "already ended" in msg:
            raise HTTPException(status_code=410, detail=msg)
        raise HTTPException(status_code=500, detail="Failed to join session")
    except Exception as exc:
        log.error("Failed to join session", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to join session")
