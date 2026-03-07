"""Session queries — create_session, get_session, end_session, get_session_history, get_user_sessions."""

import json
import logging

from server.storage.db import get_pool
from server.storage.models import SessionRecord

log = logging.getLogger("db.sessions")


def _row_to_session(row) -> SessionRecord:
    return SessionRecord(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        room_id=row["room_id"],
        started_at=str(row["started_at"]),
        ended_at=str(row["ended_at"]) if row["ended_at"] else None,
        activities=row["activities"] or [],
        duration_seconds=row["duration_seconds"],
    )


async def create_session(user_id: str, room_id: str | None = None) -> SessionRecord:
    """Create a new session history record."""
    pool = get_pool()
    row = await pool.fetchrow(
        """INSERT INTO session_history (user_id, room_id)
           VALUES ($1, $2)
           RETURNING *""",
        user_id,
        room_id,
    )
    log.info("Session created id=%s user_id=%s", row["id"], user_id)
    return _row_to_session(row)


async def get_session(session_id: str) -> SessionRecord | None:
    """Get a session by ID. Returns None if not found."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM session_history WHERE id = $1",
        session_id,
    )
    if row is None:
        return None
    return _row_to_session(row)


async def end_session(session_id: str, activities: list | None = None) -> None:
    """End a session -- set ended_at, compute duration, optionally store activities."""
    pool = get_pool()

    await pool.execute(
        """UPDATE session_history
           SET ended_at = NOW(),
               duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
               activities = COALESCE($2::jsonb, activities)
           WHERE id = $1""",
        session_id,
        json.dumps(activities) if activities is not None else None,
    )

    # Increment sessions_completed for the user
    await pool.execute(
        """UPDATE learning_progress
           SET sessions_completed = sessions_completed + 1,
               updated_at = NOW()
           WHERE user_id = (SELECT user_id FROM session_history WHERE id = $1)""",
        session_id,
    )

    log.info("Session ended id=%s", session_id)


async def get_session_history(limit: int = 20, offset: int = 0) -> list[SessionRecord]:
    """Get paginated session history (most recent first)."""
    pool = get_pool()
    rows = await pool.fetch(
        """SELECT * FROM session_history
           ORDER BY started_at DESC
           LIMIT $1 OFFSET $2""",
        limit,
        offset,
    )
    return [_row_to_session(r) for r in rows]


async def get_user_sessions(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
) -> list[SessionRecord]:
    """Get sessions for a specific user."""
    pool = get_pool()
    rows = await pool.fetch(
        """SELECT * FROM session_history
           WHERE user_id = $1
           ORDER BY started_at DESC
           LIMIT $2 OFFSET $3""",
        user_id,
        limit,
        offset,
    )
    return [_row_to_session(r) for r in rows]
