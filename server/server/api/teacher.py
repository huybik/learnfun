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
    agent = get_teacher(body.roomId)
    if not agent:
        raise HTTPException(status_code=404, detail="No teacher active for this room")

    await agent.send_text(body.text)
    return {"ok": True}
