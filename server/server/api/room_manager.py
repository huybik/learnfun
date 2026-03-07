"""Session creation and management logic — in-memory store."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from server.agents.teacher.manager import stop_teacher
from server.config import settings
from server.events.helpers import publish_event
from server.events.subjects import SUBJECTS, room_subject
from server.logging import get_logger
from server.events.models import Participant, Room

from .tokens import generate_livekit_token, generate_session_token

log = get_logger("session-manager")


# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------


@dataclass
class StoredSession:
    session_id: str
    room_id: str
    host_id: str
    host_name: str
    participants: list[str] = field(default_factory=list)
    created_at: float = 0.0
    ended_at: float | None = None


_sessions: dict[str, StoredSession] = {}


def _list_active() -> list[StoredSession]:
    return [s for s in _sessions.values() if s.ended_at is None]


# ---------------------------------------------------------------------------
# Public helpers (used by health check)
# ---------------------------------------------------------------------------


def get_active_session_count() -> int:
    return len(_list_active())


# ---------------------------------------------------------------------------
# Session manager
# ---------------------------------------------------------------------------


def _new_id() -> str:
    return str(uuid.uuid4())


async def create_session(
    user_name: str,
    voice_preference: str | None = None,
    language_code: str | None = None,
) -> dict:
    """Create a new learning session and return connection info."""
    session_id = _new_id()
    room_id = _new_id()
    user_id = _new_id()

    log.info("Creating session", session_id=session_id, room_id=room_id, user_name=user_name)

    # Store session
    _sessions[session_id] = StoredSession(
        session_id=session_id,
        room_id=room_id,
        host_id=user_id,
        host_name=user_name,
        participants=[user_id],
        created_at=datetime.now(timezone.utc).timestamp(),
    )

    # Generate tokens
    token = generate_session_token(
        user_id=user_id,
        room_id=room_id,
        role="host",
        session_id=session_id,
    )
    livekit_token = generate_livekit_token(room_id, user_id, "host")

    # Publish room created event (non-critical)
    try:
        room = Room(
            id=room_id,
            name=f"Session {session_id[:8]}",
            host_id=user_id,
            participants=[
                Participant(
                    id=user_id,
                    name=user_name,
                    role="host",
                    joined_at=datetime.now(timezone.utc).isoformat(),
                    livekit_identity=user_id,
                )
            ],
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        await publish_event(
            channel=SUBJECTS["ROOM_CREATED"],
            event_type="room.created",
            payload={"room": room.model_dump()},
            source_id="session-manager",
        )
    except Exception as exc:
        log.warning("Failed to publish room.created event", error=str(exc))

    log.info("Session created", session_id=session_id, room_id=room_id, user_id=user_id)

    return {
        "sessionId": session_id,
        "roomId": room_id,
        "userId": user_id,
        "token": token,
        "livekitToken": livekit_token,
        "livekitUrl": settings.LIVEKIT_URL,
    }


async def join_session(session_id: str, user_name: str) -> dict:
    """Join an existing session as a student."""
    session = _sessions.get(session_id)
    if session is None:
        raise ValueError(f"Session not found: {session_id}")
    if session.ended_at is not None:
        raise ValueError(f"Session already ended: {session_id}")

    user_id = _new_id()
    log.info("Joining session", session_id=session_id, user_id=user_id, user_name=user_name)

    session.participants.append(user_id)

    token = generate_session_token(
        user_id=user_id,
        room_id=session.room_id,
        role="student",
        session_id=session_id,
    )
    livekit_token = generate_livekit_token(session.room_id, user_id, "student")

    # Publish join event (non-critical)
    try:
        channel = room_subject(SUBJECTS["ROOM_JOINED"], session.room_id)
        await publish_event(
            channel=channel,
            event_type="room.user_joined",
            payload={"userId": user_id, "name": user_name},
            source_id="session-manager",
        )
    except Exception as exc:
        log.warning("Failed to publish room.user_joined event", error=str(exc))

    log.info("User joined session", session_id=session_id, user_id=user_id, user_name=user_name)

    return {
        "token": token,
        "livekitToken": livekit_token,
        "livekitUrl": settings.LIVEKIT_URL,
    }


async def end_session(session_id: str) -> None:
    """End a session."""
    session = _sessions.get(session_id)
    if session is None:
        raise ValueError(f"Session not found: {session_id}")

    log.info("Ending session", session_id=session_id, room_id=session.room_id)
    session.ended_at = datetime.now(timezone.utc).timestamp()

    await stop_teacher(session.room_id)

    try:
        await publish_event(
            channel=SUBJECTS["ROOM_CLOSED"],
            event_type="room.closed",
            payload={"roomId": session.room_id, "sessionId": session_id},
            source_id="session-manager",
        )
    except Exception as exc:
        log.warning("Failed to publish room.closed event", error=str(exc))

    log.info("Session ended", session_id=session_id)


def get_session(session_id: str) -> StoredSession | None:
    return _sessions.get(session_id)
