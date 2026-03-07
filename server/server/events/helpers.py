"""Event helpers — shared envelope construction and JSON serialization."""

from __future__ import annotations

import json
import time
from typing import Any

from .redis_bridge import redis_bridge


def serialize_event(data: Any) -> str:
    """Serialize data to JSON, coercing non-serializable values via ``str``."""
    return json.dumps(data, default=str)


async def publish_event(
    channel: str,
    event_type: str,
    payload: dict[str, Any],
    source_id: str,
) -> None:
    """Construct a standard event envelope and publish to Redis.

    Envelope shape::

        {
            "type": "<event_type>",
            "timestamp": <epoch float>,
            "sourceId": "<source_id>",
            "payload": { ... }
        }
    """
    envelope = {
        "type": event_type,
        "timestamp": time.time(),
        "sourceId": source_id,
        "payload": payload,
    }
    await redis_bridge.publish(channel, envelope)
