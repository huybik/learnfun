"""User queries — get_user, create_user, get_user_by_name, update_user."""

from server.logging import get_logger
from server.storage.db import get_pool
from server.storage.models import UserPreferences, UserProfile
from server.storage.queries._helpers import build_update_sql

log = get_logger("db.users")


def _row_to_profile(row) -> UserProfile:
    return UserProfile(
        id=str(row["id"]),
        name=row["name"],
        observations=row.get("observations") or [],
        preferences=UserPreferences(
            voice=row.get("voice_preference", "Puck"),
            language=row.get("language_code", "en-US"),
            show_avatar=row.get("show_avatar", True),
        ),
        created_at=str(row["created_at"]),
        updated_at=str(row.get("updated_at", row["created_at"])),
    )


async def create_user(
    name: str,
    preferences: dict | None = None,
) -> UserProfile:
    """Create a new user with associated profile and progress records."""
    prefs = preferences or {}
    pool = get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO users (name) VALUES ($1) RETURNING *",
            name,
        )

        voice = prefs.get("voice", "Puck")
        language = prefs.get("language", "en-US")
        show_avatar = prefs.get("show_avatar", True)

        await conn.execute(
            """INSERT INTO user_profiles (user_id, voice_preference, language_code, show_avatar)
               VALUES ($1, $2, $3, $4)""",
            row["id"],
            voice,
            language,
            show_avatar,
        )

        await conn.execute(
            "INSERT INTO learning_progress (user_id) VALUES ($1)",
            row["id"],
        )

    log.info("User created id=%s name=%s", row["id"], name)

    return UserProfile(
        id=str(row["id"]),
        name=row["name"],
        observations=[],
        preferences=UserPreferences(voice=voice, language=language, show_avatar=show_avatar),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


async def get_user(user_id: str) -> UserProfile | None:
    """Get a user by ID. Returns None if not found."""
    pool = get_pool()
    row = await pool.fetchrow(
        """SELECT u.*, p.voice_preference, p.language_code, p.show_avatar, p.observations
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
           WHERE u.id = $1""",
        user_id,
    )
    if row is None:
        return None
    return _row_to_profile(row)


async def get_user_by_name(name: str) -> UserProfile | None:
    """Get a user by name. Returns the first match or None."""
    pool = get_pool()
    row = await pool.fetchrow(
        """SELECT u.*, p.voice_preference, p.language_code, p.show_avatar, p.observations
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
           WHERE u.name = $1
           LIMIT 1""",
        name,
    )
    if row is None:
        return None
    return _row_to_profile(row)


async def update_user(
    user_id: str,
    *,
    name: str | None = None,
    observations: list[str] | None = None,
    preferences: dict | None = None,
) -> None:
    """Update user and/or profile fields."""
    pool = get_pool()

    if name is not None:
        await pool.execute(
            "UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2",
            name,
            user_id,
        )

    prefs = preferences or {}
    fields: dict[str, object] = {}
    if "voice" in prefs:
        fields["voice_preference"] = prefs["voice"]
    if "language" in prefs:
        fields["language_code"] = prefs["language"]
    if "show_avatar" in prefs:
        fields["show_avatar"] = prefs["show_avatar"]
    if observations is not None:
        fields["observations"] = observations

    sql, values = build_update_sql("user_profiles", fields, "user_id", user_id)
    if sql:
        await pool.execute(sql, *values)

    log.debug("User updated id=%s", user_id)


# ---------------------------------------------------------------------------
# Auth queries
# ---------------------------------------------------------------------------


async def create_user_with_auth(
    username: str,
    password_hash: str,
    display_name: str,
) -> dict:
    """Create a user with auth credentials + profile + progress. Returns dict with id and name."""
    pool = get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO users (name, username, password_hash) VALUES ($1, $2, $3) RETURNING *",
            display_name,
            username,
            password_hash,
        )

        await conn.execute(
            """INSERT INTO user_profiles (user_id, voice_preference, language_code, show_avatar)
               VALUES ($1, $2, $3, $4)""",
            row["id"],
            "Puck",
            "en-US",
            True,
        )

        await conn.execute(
            "INSERT INTO learning_progress (user_id) VALUES ($1)",
            row["id"],
        )

    log.info("Auth user created id=%s username=%s", row["id"], username)
    return {"id": str(row["id"]), "name": row["name"]}


async def get_user_by_username(username: str) -> dict | None:
    """Get a user by username. Returns row dict with password_hash, or None."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, name, username, password_hash, created_at, updated_at FROM users WHERE username = $1",
        username,
    )
    if row is None:
        return None
    return dict(row)


async def get_user_by_id(user_id: str) -> dict | None:
    """Get a user by ID. Returns row dict without password_hash, or None."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, name, username, created_at, updated_at FROM users WHERE id = $1",
        user_id,
    )
    if row is None:
        return None
    return dict(row)
