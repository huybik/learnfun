"""Teacher API — send text/image + ensure teacher is running for a room."""

import asyncio
import base64 as b64mod

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from server.agents.teacher.manager import get_teacher, spawn_teacher
from server.logging import get_logger

from .tokens import generate_livekit_token

log = get_logger("api:teacher")
router = APIRouter()


class TeacherMessageBody(BaseModel):
    roomId: str
    text: str


class TeacherImageBody(BaseModel):
    roomId: str
    imageBase64: str


@router.post("/teacher/message")
async def post_teacher_message(body: TeacherMessageBody):
    log.info("Teacher message received", room_id=body.roomId, text_len=len(body.text))
    agent = get_teacher(body.roomId)
    if not agent:
        log.warning("No teacher active for room", room_id=body.roomId)
        raise HTTPException(status_code=404, detail="No teacher active for this room")

    sent = await agent.send_text(body.text)
    if not sent:
        log.warning("Teacher unavailable for message", room_id=body.roomId)
        raise HTTPException(status_code=503, detail="Teacher is temporarily unavailable")

    log.debug("Teacher message forwarded", room_id=body.roomId)
    return {"ok": True}


@router.post("/teacher/image")
async def post_teacher_image(body: TeacherImageBody):
    """Send a game screenshot to the teacher for visual context."""
    agent = get_teacher(body.roomId)
    if not agent:
        raise HTTPException(status_code=404, detail="No teacher active for this room")

    # Strip data URL prefix if present
    raw = body.imageBase64
    mime_type = "image/jpeg"
    if raw.startswith("data:"):
        header, raw = raw.split(",", 1)
        if "image/png" in header:
            mime_type = "image/png"

    image_bytes = b64mod.b64decode(raw)
    sent = await agent.send_image(image_bytes, mime_type=mime_type)
    if not sent:
        raise HTTPException(status_code=503, detail="Teacher is temporarily unavailable")

    return {"ok": True}


class EnsureTeacherBody(BaseModel):
    roomId: str
    userName: str
    voicePreference: str | None = None
    languageCode: str | None = None


@router.post("/teacher/ensure")
async def post_ensure_teacher(body: EnsureTeacherBody, request: Request):
    """Ensure a teacher agent is running for the room. No-op if already active."""
    room_id = body.roomId

    if get_teacher(room_id):
        log.debug("Teacher already active", room_id=room_id)
        return {"ok": True, "spawned": False}

    log.info("Spawning teacher on resume", room_id=room_id)
    user_profile = {
        "id": "",
        "name": body.userName,
        "preferences": {
            "voice": body.voicePreference,
            "language": body.languageCode,
        },
    }
    teacher_token = generate_livekit_token(room_id, "ai-teacher", "teacher")

    task = asyncio.create_task(
        spawn_teacher(
            room_id=room_id,
            livekit_token=teacher_token,
            user_profile=user_profile,
            participants=[user_profile],
            ta_agent=request.app.state.ta_agent,
            tool_registry=request.app.state.tool_registry,
        )
    )

    def _log_result(t: asyncio.Task[object]) -> None:
        try:
            t.result()
        except Exception as exc:
            log.error("Teacher spawn failed on resume", room_id=room_id, error=str(exc))

    task.add_done_callback(_log_result)

    return {"ok": True, "spawned": True}
