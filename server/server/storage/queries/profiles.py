"""Profile queries — get_profile, update_profile, update_embedding, find_similar_profiles."""

import json
import logging

from server.storage.db import get_pool
from server.storage.models import UserPreferences, UserProfile

log = logging.getLogger("db.profiles")


async def get_profile(user_id: str) -> UserProfile | None:
    """Get a user's full profile (user + profile joined). Returns None if not found."""
    pool = get_pool()
    row = await pool.fetchrow(
        """SELECT u.name, u.created_at, p.*
           FROM user_profiles p
           JOIN users u ON u.id = p.user_id
           WHERE p.user_id = $1""",
        user_id,
    )
    if row is None:
        return None

    return UserProfile(
        id=str(row["user_id"]),
        name=row["name"],
        observations=row["observations"] or [],
        preferences=UserPreferences(
            voice=row["voice_preference"],
            language=row["language_code"],
            show_avatar=row["show_avatar"],
        ),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


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
    updates: list[str] = []
    values: list = []
    idx = 1

    if voice is not None:
        updates.append(f"voice_preference = ${idx}")
        values.append(voice)
        idx += 1
    if language is not None:
        updates.append(f"language_code = ${idx}")
        values.append(language)
        idx += 1
    if show_avatar is not None:
        updates.append(f"show_avatar = ${idx}")
        values.append(show_avatar)
        idx += 1
    if observations is not None:
        updates.append(f"observations = ${idx}")
        values.append(observations)
        idx += 1
    if difficulty_level is not None:
        updates.append(f"difficulty_level = ${idx}")
        values.append(difficulty_level)
        idx += 1
    if profile_data is not None:
        updates.append(f"profile_data = ${idx}")
        values.append(json.dumps(profile_data))
        idx += 1

    if not updates:
        return

    updates.append("updated_at = NOW()")
    values.append(user_id)
    set_clause = ", ".join(updates)

    pool = get_pool()
    await pool.execute(
        f"UPDATE user_profiles SET {set_clause} WHERE user_id = ${idx}",
        *values,
    )
    log.debug("Profile updated user_id=%s", user_id)


async def update_embedding(user_id: str, embedding: list[float]) -> None:
    """Store a vector embedding for the user."""
    vector_str = f"[{','.join(str(v) for v in embedding)}]"
    pool = get_pool()
    await pool.execute(
        "UPDATE user_profiles SET embedding = $1::vector, updated_at = NOW() WHERE user_id = $2",
        vector_str,
        user_id,
    )
    log.debug("Embedding updated user_id=%s dims=%d", user_id, len(embedding))


async def find_similar_profiles(
    embedding: list[float],
    limit: int = 10,
) -> list[dict]:
    """Find profiles with similar embeddings using pgvector cosine distance."""
    vector_str = f"[{','.join(str(v) for v in embedding)}]"
    pool = get_pool()
    rows = await pool.fetch(
        """SELECT u.name, u.created_at, p.*,
                  1 - (p.embedding <=> $1::vector) AS similarity
           FROM user_profiles p
           JOIN users u ON u.id = p.user_id
           WHERE p.embedding IS NOT NULL
           ORDER BY p.embedding <=> $1::vector
           LIMIT $2""",
        vector_str,
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
