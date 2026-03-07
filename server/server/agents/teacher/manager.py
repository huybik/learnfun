"""Per-room TeacherAgent lifecycle manager."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from server.agents.ta.agent import TAAgent
from server.logging import get_logger
from server.tools.registry import ToolRegistry

from .agent import TeacherAgent

log = get_logger("teacher:manager")

# room_id → TeacherAgent
_teachers: dict[str, TeacherAgent] = {}


async def spawn_teacher(
    *,
    room_id: str,
    livekit_token: str,
    user_profile: dict[str, Any],
    participants: list[dict[str, Any]],
    ta_agent: TAAgent,
    tool_registry: ToolRegistry,
) -> TeacherAgent:
    """Create and start a TeacherAgent for a room."""
    if room_id in _teachers:
        log.warning("Teacher already exists for room, replacing", room_id=room_id)
        await stop_teacher(room_id)

    agent = TeacherAgent(
        room_id=room_id,
        livekit_token=livekit_token,
        user_profile=user_profile,
        participants=participants,
        ta_agent=ta_agent,
        tool_registry=tool_registry,
    )

    # Register early so callers can find the agent while it's starting.
    # send_text already no-ops if Gemini isn't connected yet.
    _teachers[room_id] = agent
    try:
        await agent.start()
    except Exception:
        _teachers.pop(room_id, None)
        raise
    log.info("Teacher spawned", room_id=room_id)
    return agent


async def stop_teacher(room_id: str) -> None:
    """Stop and remove the teacher for a room."""
    agent = _teachers.pop(room_id, None)
    if agent:
        await agent.stop()
        log.info("Teacher stopped", room_id=room_id)


def get_teacher(room_id: str) -> Optional[TeacherAgent]:
    """Get the active teacher for a room."""
    return _teachers.get(room_id)


async def stop_all() -> None:
    """Stop all active teachers (used during shutdown)."""
    room_ids = list(_teachers.keys())
    if room_ids:
        log.info("Stopping all teachers", count=len(room_ids))
        await asyncio.gather(*(stop_teacher(rid) for rid in room_ids))
