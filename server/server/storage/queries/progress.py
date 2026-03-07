"""Progress queries — get_progress, add_points, update_streak, record_game_result, get_leaderboard."""

import json

from server.logging import get_logger
from server.storage.db import get_pool
from server.storage.models import LearningProgress

log = get_logger("db.progress")


def _row_to_progress(row) -> LearningProgress:
    return LearningProgress(
        user_id=str(row["user_id"]),
        total_points=row["total_points"],
        current_streak=row["current_streak"],
        highest_streak=row["highest_streak"],
        unit_progress=row["unit_progress"] or {},
        last_activity_at=str(row["last_activity_at"]) if row["last_activity_at"] else None,
    )


async def get_progress(user_id: str) -> LearningProgress:
    """Get learning progress for a user. Returns defaults if no record exists."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM learning_progress WHERE user_id = $1",
        user_id,
    )
    if row is None:
        return LearningProgress(user_id=user_id)
    return _row_to_progress(row)


async def add_points(user_id: str, points: int) -> None:
    """Add points to a user's total and update last_activity_at."""
    pool = get_pool()
    await pool.execute(
        """UPDATE learning_progress
           SET total_points = total_points + $1,
               last_activity_at = NOW(),
               updated_at = NOW()
           WHERE user_id = $2""",
        points,
        user_id,
    )
    log.debug("Points added user_id=%s points=%d", user_id, points)


async def update_streak(user_id: str, streak: int) -> None:
    """Update streak. Sets current_streak and bumps highest_streak if needed."""
    pool = get_pool()
    await pool.execute(
        """UPDATE learning_progress
           SET current_streak = $1,
               highest_streak = GREATEST(highest_streak, $1),
               last_activity_at = NOW(),
               updated_at = NOW()
           WHERE user_id = $2""",
        streak,
        user_id,
    )
    log.debug("Streak updated user_id=%s streak=%d", user_id, streak)


async def record_game_result(
    *,
    user_id: str,
    game_type: str,
    score: int,
    session_id: str | None = None,
    template_id: str | None = None,
    accuracy: float | None = None,
    duration_seconds: int | None = None,
    details: dict | None = None,
) -> str:
    """Record a game result and increment games_played counter. Returns the result id."""
    pool = get_pool()

    row = await pool.fetchrow(
        """INSERT INTO game_results
               (session_id, user_id, game_type, template_id, score, accuracy, duration_seconds, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id""",
        session_id,
        user_id,
        game_type,
        template_id,
        score,
        accuracy,
        duration_seconds,
        json.dumps(details or {}),
    )

    await pool.execute(
        """UPDATE learning_progress
           SET games_played = games_played + 1,
               last_activity_at = NOW(),
               updated_at = NOW()
           WHERE user_id = $1""",
        user_id,
    )

    log.debug("Game result recorded user_id=%s game_type=%s", user_id, game_type)
    return str(row["id"])


async def get_leaderboard(limit: int = 10) -> list[dict]:
    """Get the leaderboard (top users by total points)."""
    pool = get_pool()
    rows = await pool.fetch(
        """SELECT lp.user_id, u.name, lp.total_points, lp.highest_streak
           FROM learning_progress lp
           JOIN users u ON u.id = lp.user_id
           ORDER BY lp.total_points DESC
           LIMIT $1""",
        limit,
    )
    return [
        {
            "user_id": str(r["user_id"]),
            "name": r["name"],
            "total_points": r["total_points"],
            "highest_streak": r["highest_streak"],
        }
        for r in rows
    ]
