"""POST /api/teacher/message — send text to the AI teacher in a room."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.agents.teacher.manager import get_teacher
from server.logging import get_logger

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
