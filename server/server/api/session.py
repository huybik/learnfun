"""POST /api/session — create a new learning session."""

import asyncio

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from server.agents.teacher.manager import spawn_teacher
from server.logging import get_logger

from .room_manager import create_session
from .tokens import generate_livekit_token

log = get_logger("api:session")
router = APIRouter()


class CreateSessionRequest(BaseModel):
    userName: str
    voicePreference: str | None = None
    languageCode: str | None = None


@router.post("/session")
async def post_session(body: CreateSessionRequest, request: Request):
    try:
        result = await create_session(
            user_name=body.userName,
            voice_preference=body.voicePreference,
            language_code=body.languageCode,
        )
        log.info("Session created via API", session_id=result["sessionId"], room_id=result["roomId"])

        # Spawn teacher agent in the background
        room_id = result["roomId"]
        user_profile = {
            "id": result.get("userId", ""),
            "name": body.userName,
            "preferences": {
                "voice": body.voicePreference,
                "language": body.languageCode,
            },
        }
        teacher_token = generate_livekit_token(room_id, "ai-teacher", "teacher")

        asyncio.create_task(
            spawn_teacher(
                room_id=room_id,
                livekit_token=teacher_token,
                user_profile=user_profile,
                participants=[user_profile],
                ta_agent=request.app.state.ta_agent,
                tool_registry=request.app.state.tool_registry,
            )
        )

        return result
    except Exception as exc:
        log.error("Failed to create session", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to create session")
