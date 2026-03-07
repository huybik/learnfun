"""JWT token minting/verification using python-jose."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from server.config import settings
from server.logging import get_logger

log = get_logger("jwt-auth")

ALGORITHM = "HS256"
SESSION_TOKEN_EXPIRY_HOURS = 24
LIVEKIT_TOKEN_EXPIRY_HOURS = 24


# ---------------------------------------------------------------------------
# Session tokens
# ---------------------------------------------------------------------------


def generate_session_token(
    *,
    user_id: str,
    room_id: str,
    role: str,
    session_id: str,
) -> str:
    """Generate a signed JWT for session access."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "userId": user_id,
        "roomId": room_id,
        "role": role,
        "sessionId": session_id,
        "iat": now,
        "exp": now + timedelta(hours=SESSION_TOKEN_EXPIRY_HOURS),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)
    log.debug("Session token generated", user_id=user_id, room_id=room_id)
    return token


def validate_session_token(token: str) -> dict | None:
    """Validate a session JWT. Returns payload dict or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        return {
            "userId": payload["userId"],
            "roomId": payload["roomId"],
            "role": payload["role"],
            "sessionId": payload["sessionId"],
        }
    except JWTError as err:
        log.warning("Token validation failed", error=str(err))
        return None


# ---------------------------------------------------------------------------
# LiveKit tokens
# ---------------------------------------------------------------------------


def generate_livekit_token(room_id: str, user_id: str, role: str) -> str:
    """Generate a LiveKit-compatible access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iss": settings.LIVEKIT_API_KEY,
        "iat": now,
        "exp": now + timedelta(hours=LIVEKIT_TOKEN_EXPIRY_HOURS),
        "video": {
            "room": room_id,
            "roomJoin": True,
            "canPublish": role in ("host", "student"),
            "canSubscribe": True,
        },
    }
    token = jwt.encode(payload, settings.LIVEKIT_API_SECRET, algorithm=ALGORITHM)
    log.debug("LiveKit token generated", room_id=room_id, user_id=user_id, role=role)
    return token
