"""Teacher API — send text + ensure teacher is running for a room."""

import asyncio

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


@router.post("/teacher/message")
async def post_teacher_message(body: TeacherMessageBody):
    log.info("Teacher message received", room_id=body.roomId, text_len=len(body.text))
    agent = get_teacher(body.roomId)
    if not agent:
        log.warning("No teacher active for room", room_id=body.roomId)
        raise HTTPException(status_code=404, detail="No teacher active for this room")

    await agent.send_text(body.text)
    log.debug("Teacher message forwarded", room_id=body.roomId)
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
