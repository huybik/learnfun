"""Profile queries — update_profile, update_embedding, find_similar_profiles.

Note: get_profile is consolidated into users.get_user().
"""

import json

from server.logging import get_logger
from server.storage.db import get_pool
from server.storage.queries._helpers import build_update_sql, format_vector

log = get_logger("db.profiles")


async def update_profile(
    user_id: str,
    *,
    voice: str | None = None,
    language: str | None = None,
    show_avatar: bool | None = None,
    observations: list[str] | None = None,
    difficulty_level: str | None = None,
    profile_data: dict | None = None,
) -> None:
    """Update profile fields. Accepts any subset of profile-related data."""
    fields: dict[str, object] = {}
    if voice is not None:
        fields["voice_preference"] = voice
    if language is not None:
        fields["language_code"] = language
    if show_avatar is not None:
        fields["show_avatar"] = show_avatar
    if observations is not None:
        fields["observations"] = observations
    if difficulty_level is not None:
        fields["difficulty_level"] = difficulty_level
    if profile_data is not None:
        fields["profile_data"] = json.dumps(profile_data)

    sql, values = build_update_sql("user_profiles", fields, "user_id", user_id)
    if not sql:
        return

    pool = get_pool()
    await pool.execute(sql, *values)
    log.debug("Profile updated user_id=%s", user_id)


async def update_embedding(user_id: str, embedding: list[float]) -> None:
    """Store a vector embedding for the user."""
    pool = get_pool()
    await pool.execute(
        "UPDATE user_profiles SET embedding = $1::vector, updated_at = NOW() WHERE user_id = $2",
        format_vector(embedding),
        user_id,
    )
    log.debug("Embedding updated user_id=%s dims=%d", user_id, len(embedding))


async def find_similar_profiles(
    embedding: list[float],
    limit: int = 10,
) -> list[dict]:
    """Find profiles with similar embeddings using pgvector cosine distance."""
    pool = get_pool()
    rows = await pool.fetch(
        """SELECT u.name, u.created_at, p.*,
                  1 - (p.embedding <=> $1::vector) AS similarity
           FROM user_profiles p
           JOIN users u ON u.id = p.user_id
           WHERE p.embedding IS NOT NULL
           ORDER BY p.embedding <=> $1::vector
           LIMIT $2""",
        format_vector(embedding),
        limit,
    )

    return [
        {
            "id": str(r["user_id"]),
            "name": r["name"],
            "observations": r["observations"] or [],
            "preferences": {
                "voice": r["voice_preference"],
                "language": r["language_code"],
                "show_avatar": r["show_avatar"],
            },
            "created_at": str(r["created_at"]),
            "updated_at": str(r["updated_at"]),
            "similarity": r["similarity"],
        }
        for r in rows
    ]
