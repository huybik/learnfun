"""POST /api/session — create a new learning session."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.logging import get_logger

from .session_manager import create_session

log = get_logger("api:session")
router = APIRouter()


class CreateSessionRequest(BaseModel):
    userName: str
    voicePreference: str | None = None
    languageCode: str | None = None


@router.post("/session")
async def post_session(body: CreateSessionRequest):
    try:
        result = await create_session(
            user_name=body.userName,
            voice_preference=body.voicePreference,
            language_code=body.languageCode,
        )
        log.info("Session created via API", session_id=result["sessionId"], room_id=result["roomId"])
        return result
    except Exception as exc:
        log.error("Failed to create session", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to create session")
