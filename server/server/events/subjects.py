"""Channel/subject names — single source of truth."""

SUBJECTS = {
    # Teacher -> TA
    "TA_REQUESTS": "ta.requests",
    "TA_RESPONSES": "ta.responses",
    # TA -> Frontend
    "CONTENT_PUSH": "room.{room_id}.content",
    "CONTENT_LOADED": "room.{room_id}.content.ack",
    # Room lifecycle
    "ROOM_CREATED": "room.created",
    "ROOM_JOINED": "room.{room_id}.joined",
    "ROOM_LEFT": "room.{room_id}.left",
    "ROOM_CLOSED": "room.closed",
    # UI control (Teacher -> Frontend)
    "UI_CONTROL": "room.{room_id}.ui",
    # Transcriptions (Teacher -> Frontend)
    "TRANSCRIPT": "room.{room_id}.transcript",
    # Game events
    "GAME_STARTED": "room.{room_id}.game.started",
    "GAME_ENDED": "room.{room_id}.game.ended",
    "GAME_ACTION": "room.{room_id}.game.action",
    # System
    "HEALTH": "system.health",
    "METRICS": "system.metrics",
}


def room_subject(template: str, room_id: str) -> str:
    """Replace ``{room_id}`` placeholder in a subject template."""
    return template.replace("{room_id}", room_id)
