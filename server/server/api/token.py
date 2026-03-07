"""GET /api/get-token — generate a LiveKit token.

Since Gemini now runs server-side, this endpoint only returns a LiveKit
token for the client to join the room as a listener/participant.
"""

from fastapi import APIRouter, HTTPException, Query

from server.logging import get_logger

from .tokens import generate_livekit_token

log = get_logger("api:token")
router = APIRouter()


@router.get("/get-token")
async def get_token(
    room_id: str = Query(..., alias="roomId"),
    user_id: str = Query(..., alias="userId"),
    role: str = Query("student"),
):
    """Return a LiveKit access token for the given room and user."""
    try:
        token = generate_livekit_token(room_id, user_id, role)
        return {"token": token}
    except Exception as exc:
        log.error("Failed to generate token", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to generate token")
