"""Profile queries — update_profile.

Note: get_profile is consolidated into users.get_user().
"""

import json

from server.logging import get_logger
from server.storage.db import get_pool
from server.storage.queries._helpers import build_update_sql

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


async def append_observation(user_id: str, observation: str) -> None:
    """Append a single observation to the user's profile."""
    pool = get_pool()
    await pool.execute(
        "UPDATE user_profiles SET observations = array_append(observations, $1), updated_at = NOW() WHERE user_id = $2",
        observation,
        user_id,
    )
    log.debug("Observation appended user_id=%s", user_id)
