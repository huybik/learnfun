"""GET /api/room/{room_id}/events — SSE stream via Redis pub/sub."""

from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from starlette.responses import StreamingResponse

from server.events.helpers import serialize_event
from server.events.redis_bridge import redis_bridge
from server.events.subjects import SUBJECTS, room_subject
from server.logging import get_logger

log = get_logger("api:room-events")
router = APIRouter()

# Mapping: Redis channel template -> SSE event name
_ROOM_CHANNELS = [
    (SUBJECTS["CONTENT_PUSH"], "content_ready"),
    (SUBJECTS["UI_CONTROL"], "ui_control"),
    (SUBJECTS["GAME_STARTED"], "game_started"),
    (SUBJECTS["GAME_ENDED"], "game_ended"),
    (SUBJECTS["GAME_ACTION"], "game_action"),
]


async def _event_generator(room_id: str) -> AsyncGenerator[str, None]:
    """Subscribe to room Redis channels and yield SSE frames."""
    tasks: list[asyncio.Task] = []
    queue: asyncio.Queue[tuple[str, object]] = asyncio.Queue()

    async def _reader(channel: str, sse_event: str) -> None:
        try:
            async for data in redis_bridge.subscribe(channel):
                await queue.put((sse_event, data))
        except asyncio.CancelledError:
            pass

    # Start a reader task per channel
    for template, sse_name in _ROOM_CHANNELS:
        channel = room_subject(template, room_id)
        tasks.append(asyncio.create_task(_reader(channel, sse_name)))

    # Confirm to the client
    sse_names = [name for _, name in _ROOM_CHANNELS]
    yield f"event: connected\ndata: {json.dumps({'roomId': room_id, 'subjects': sse_names})}\n\n"

    try:
        while True:
            try:
                sse_event, data = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"event: {sse_event}\ndata: {serialize_event(data)}\n\n"
            except asyncio.TimeoutError:
                # Keep-alive ping
                yield ": ping\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        log.info("SSE client disconnected", room_id=room_id)
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


@router.get("/room/{room_id}/events")
async def room_events(room_id: str):
    log.info("SSE client connected", room_id=room_id)
    return StreamingResponse(
        _event_generator(room_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    )
