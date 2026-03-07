"""Asyncpg connection pool lifecycle."""

import logging

import asyncpg

from server.config import settings

log = logging.getLogger("db")

_pool: asyncpg.Pool | None = None


async def init_db() -> None:
    """Create the asyncpg connection pool. Call at FastAPI startup."""
    global _pool
    if _pool is not None:
        return
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=20,
        command_timeout=5,
    )
    log.info("PostgreSQL pool created")


def get_pool() -> asyncpg.Pool:
    """Return the active pool. Raises if init_db() has not been called."""
    if _pool is None:
        raise RuntimeError("Database pool not initialised — call init_db() first")
    return _pool


async def close_db() -> None:
    """Gracefully close the pool. Call at FastAPI shutdown."""
    global _pool
    if _pool is None:
        return
    await _pool.close()
    _pool = None
    log.info("PostgreSQL pool closed")
