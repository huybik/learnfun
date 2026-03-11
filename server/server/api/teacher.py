"""Teacher API — send text/image + ensure teacher is running for a room."""

import asyncio
import base64 as b64mod

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from server.agents.teacher.manager import get_teacher, spawn_teacher
from server.logging import get_logger
from server.sync.yjs_server import get_game_scores

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

    text = body.text
    # Enrich game state updates with all players' scores from Yjs
    if "[game_state_update" in text:
        scores = await get_game_scores(body.roomId)
        if len(scores) > 1:
            # Resolve player IDs to names via the teacher's participant map
            names = agent._participant_names if hasattr(agent, '_participant_names') else {}
            score_summary = " | ".join(
                f"{names.get(pid, pid)}: {s}" for pid, s in scores.items()
            )
            text += f" [all_scores: {score_summary}]"

    sent = await agent.send_text(text)
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

    # Build participant list from session store so teacher knows everyone
    from .room_manager import get_session_by_room
    session = get_session_by_room(room_id)

    user_profile = {
        "id": session.host_id if session else "",
        "name": session.host_name if session else body.userName,
        "preferences": {
            "voice": body.voicePreference,
            "language": body.languageCode,
        },
    }
    participants = []
    if session:
        for pid in session.participants:
            pname = session.participant_names.get(pid, "Student")
            role = "host" if pid == session.host_id else "student"
            participants.append({"id": pid, "name": pname, "role": role})
    else:
        participants = [user_profile]

    teacher_token = generate_livekit_token(room_id, "ai-teacher", "teacher", name="AI Teacher")

    task = asyncio.create_task(
        spawn_teacher(
            room_id=room_id,
            livekit_token=teacher_token,
            user_profile=user_profile,
            participants=participants,
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
