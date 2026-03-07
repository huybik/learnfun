"""RedisBridge — publish events to Redis channels, subscribe for SSE/WS delivery."""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import redis.asyncio as aioredis

from server.config import settings
from server.logging import get_logger

log = get_logger("redis_bridge")


class RedisBridge:
    """Thin wrapper around ``redis.asyncio`` for event fan-out.

    * ``publish`` — serialise to JSON and push to a Redis channel.
    * ``subscribe`` — yield messages from a Redis channel (used by SSE endpoints).
    """

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    async def connect(self) -> None:
        """Open the Redis connection (call at FastAPI startup)."""
        self._redis = aioredis.from_url(
            settings.REDIS_URL, decode_responses=True
        )
        # Verify connectivity
        await self._redis.ping()
        log.info("connected", url=settings.REDIS_URL)

    async def close(self) -> None:
        """Close the Redis connection (call at FastAPI shutdown)."""
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None
            log.info("closed")

    # -- public API ----------------------------------------------------------

    async def publish(self, channel: str, data: Any) -> None:
        """Publish JSON-encoded *data* to *channel*."""
        if self._redis is None:
            raise RuntimeError("RedisBridge not connected — call connect() first")
        payload = json.dumps(data, default=str)
        await self._redis.publish(channel, payload)
        log.debug("published", channel=channel)

    async def subscribe(self, channel: str) -> AsyncIterator[Any]:
        """Yield parsed messages from *channel* until cancelled."""
        if self._redis is None:
            raise RuntimeError("RedisBridge not connected — call connect() first")
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(channel)
        log.info("subscribed", channel=channel)
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    yield json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    yield message["data"]
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()


# Module-level singleton
redis_bridge = RedisBridge()
