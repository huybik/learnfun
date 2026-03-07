"""
Yjs WebSocket server using pycrdt-websocket.

Each room gets its own CRDT document. Documents are created on first
connection and cleaned up automatically when all clients leave.

Browser clients connect via y-websocket provider to:
    ws://<host>/yjs/<room_id>
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from pycrdt.websocket import ASGIServer, WebsocketServer

from server.logging import get_logger

if TYPE_CHECKING:
    from fastapi import FastAPI

log = get_logger("yjs")

# ---------------------------------------------------------------------------
# Singleton WebsocketServer
# ---------------------------------------------------------------------------

yjs_server = WebsocketServer(
    # Rooms are immediately ready for sync when opened.
    rooms_ready=True,
    # Auto-delete room (and its doc) when last client disconnects.
    auto_clean_rooms=True,
)


# ---------------------------------------------------------------------------
# ASGI app that handles the /yjs/* WebSocket upgrade
# ---------------------------------------------------------------------------

async def _on_connect(scope: dict, _send_receive: dict) -> bool:
    """Log new Yjs connections. Return False to accept."""
    path: str = scope.get("path", "")
    log.info("yjs_connect", path=path)
    return False  # accept connection


async def _on_disconnect(scope: dict) -> None:
    path: str = scope.get("path", "")
    log.info("yjs_disconnect", path=path)


yjs_asgi_app = ASGIServer(
    yjs_server,
    on_connect=_on_connect,
    on_disconnect=_on_disconnect,
)


# ---------------------------------------------------------------------------
# Lifecycle helpers — call from the FastAPI lifespan context manager
# ---------------------------------------------------------------------------

async def start_yjs() -> asyncio.Task:
    """Start the Yjs WebSocket server. Returns the background task."""
    task = asyncio.create_task(yjs_server.start())
    await yjs_server.started.wait()
    log.info("yjs_server_started")
    return task


async def stop_yjs(task: asyncio.Task) -> None:
    """Stop the Yjs WebSocket server and cancel its task."""
    yjs_server.stop()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    log.info("yjs_server_stopped")


def mount_yjs(app: FastAPI) -> None:
    """Mount the Yjs ASGI handler at ``/yjs``.

    Clients connect to ``ws://<host>/yjs/<room_id>``.
    The room_id is extracted from the path by pycrdt-websocket.

    Call ``start_yjs()`` / ``stop_yjs()`` in the app lifespan to manage
    the server lifecycle.
    """
    app.mount("/yjs", yjs_asgi_app)
