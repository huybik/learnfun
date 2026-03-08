"""Concrete tool handlers — wire tools to content, events, and storage."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from server.content.bundles import get_bundle, store_bundle
from server.content.models import FilledBundle
from server.content.templates import get_game, list_games
from server.events.helpers import publish_event
from server.events.subjects import SUBJECTS, room_subject
from server.logging import get_logger
from .registry import ToolRegistry
from .schemas import ToolHandlerContext, ToolResponse

log = get_logger("tools.handlers")


# ------------------------------------------------------------------
# Registration
# ------------------------------------------------------------------


def register_all(registry: ToolRegistry) -> None:
    """Register real handlers for every tool."""
    registry.register("query_content", handle_query_content)
    registry.register("execute_filled_bundle", handle_execute_filled_bundle)
    registry.register("light_control", handle_light_control)
    registry.register("signal_feedback", handle_signal_feedback)
    registry.register("update_profile", handle_update_profile)
    registry.register("load_content", handle_load_content)
    registry.register("get_room_state", handle_get_room_state)

    # request_ta_action is dispatched directly by TeacherAgent;
    # registry stub exists only as a fallback.
    async def _noop_ta(params: dict, ctx: ToolHandlerContext) -> ToolResponse:
        return ToolResponse(
            call_id=ctx.call_id,
            success=True,
            data={"note": "Handled directly by TeacherAgent"},
        )

    registry.register("request_ta_action", _noop_ta)


# ------------------------------------------------------------------
# query_content
# ------------------------------------------------------------------


async def handle_query_content(params: dict, ctx: ToolHandlerContext) -> ToolResponse:
    """Search games by optional tags."""
    games = list_games()

    tags = params.get("tags")
    if tags:
        tag_set = {t.lower() for t in tags}
        games = [
            g for g in games
            if tag_set & {tag.lower() for tag in g.tags}
        ]

    return ToolResponse(
        call_id=ctx.call_id,
        success=True,
        data={"games": [g.model_dump(exclude={"skill_text"}) for g in games]},
    )


# ------------------------------------------------------------------
# execute_filled_bundle
# ------------------------------------------------------------------


async def handle_execute_filled_bundle(params: dict, ctx: ToolHandlerContext) -> ToolResponse:
    """Store a filled bundle and push it to the room."""
    bundle_id = params["bundle_id"]
    room_id = params["room_id"]
    filled_data = params["filled_data"]

    # Verify the game exists
    try:
        get_game(bundle_id)
    except FileNotFoundError:
        return ToolResponse(call_id=ctx.call_id, success=False, error=f"Game not found: {bundle_id}")

    bundle = FilledBundle(
        templateId=bundle_id,
        sessionId=room_id,
        filledSlots=filled_data,
        createdAt=datetime.now(timezone.utc).isoformat(),
    )
    store_bundle(bundle)

    # Push content to room
    channel = room_subject(SUBJECTS["CONTENT_PUSH"], room_id)
    await publish_event(
        channel=channel,
        event_type="ta.content_ready",
        payload={
            "contentId": bundle.sessionId,
            "bundle": bundle.model_dump(),
            "metadata": {"templateId": bundle_id},
        },
        source_id=ctx.caller.id,
    )

    # Always publish game_started
    game_ch = room_subject(SUBJECTS["GAME_STARTED"], room_id)
    await publish_event(
        channel=game_ch,
        event_type="game.started",
        payload={"templateId": bundle_id, "roomId": room_id},
        source_id=ctx.caller.id,
    )

    return ToolResponse(call_id=ctx.call_id, success=True, data={"bundleId": bundle.sessionId})


# ------------------------------------------------------------------
# light_control
# ------------------------------------------------------------------


async def handle_light_control(params: dict, ctx: ToolHandlerContext) -> ToolResponse:
    """Publish UI control event (highlight, emote, focus, pause, resume)."""
    room_id = ctx.caller.session_id
    channel = room_subject(SUBJECTS["UI_CONTROL"], room_id)

    await publish_event(
        channel=channel,
        event_type="light_control",
        payload={"action": params["action"], "params": params.get("params", {})},
        source_id=ctx.caller.id,
    )

    return ToolResponse(call_id=ctx.call_id, success=True, data={"applied": True})


# ------------------------------------------------------------------
# signal_feedback
# ------------------------------------------------------------------


async def handle_signal_feedback(params: dict, ctx: ToolHandlerContext) -> ToolResponse:
    """Publish visual feedback and optionally award points."""
    room_id = ctx.caller.session_id
    channel = room_subject(SUBJECTS["UI_CONTROL"], room_id)

    await publish_event(
        channel=channel,
        event_type="signal_feedback",
        payload={
            "feedbackType": params["type"],
            "points": params.get("points"),
            "message": params.get("message"),
        },
        source_id=ctx.caller.id,
    )

    points = params.get("points")
    if points:
        from server.api.room_manager import get_session_by_room
        from server.storage.queries.progress import add_points

        session = get_session_by_room(room_id)
        if session:
            try:
                await add_points(session.host_id, points)
                log.info("Points persisted", room_id=room_id, user_id=session.host_id, points=points)
            except Exception as exc:
                log.warning("Failed to persist points", error=str(exc))

    return ToolResponse(call_id=ctx.call_id, success=True, data={"delivered": True})


# ------------------------------------------------------------------
# update_profile
# ------------------------------------------------------------------


async def handle_update_profile(params: dict, ctx: ToolHandlerContext) -> ToolResponse:
    """Record a learning observation."""
    room_id = ctx.caller.session_id
    observation = params["observation"]

    log.info("Observation recorded", room_id=room_id, observation=observation)

    # Persist to DB
    from server.api.room_manager import get_session_by_room
    from server.storage.queries.profiles import append_observation

    session = get_session_by_room(room_id)
    if session:
        try:
            await append_observation(session.host_id, observation)
        except Exception as exc:
            log.warning("Failed to persist observation", error=str(exc))

    # Publish for frontend visibility
    channel = room_subject(SUBJECTS["UI_CONTROL"], room_id)
    await publish_event(
        channel=channel,
        event_type="profile_observation",
        payload={"observation": observation},
        source_id=ctx.caller.id,
    )

    return ToolResponse(call_id=ctx.call_id, success=True, data={"recorded": True})


# ------------------------------------------------------------------
# load_content
# ------------------------------------------------------------------


async def handle_load_content(params: dict, ctx: ToolHandlerContext) -> ToolResponse:
    """Load a content item (game or bundle) by ID."""
    content_type = params["content_type"]
    content_id = params["content_id"]

    try:
        if content_type == "game":
            item = get_game(content_id)
            return ToolResponse(call_id=ctx.call_id, success=True, data={"game": item.model_dump()})
        if content_type == "bundle":
            item = get_bundle(content_id)
            return ToolResponse(call_id=ctx.call_id, success=True, data={"bundle": item.model_dump()})
        return ToolResponse(call_id=ctx.call_id, success=False, error=f"Unsupported content type: {content_type}")
    except FileNotFoundError as exc:
        return ToolResponse(call_id=ctx.call_id, success=False, error=str(exc))


# ------------------------------------------------------------------
# get_room_state
# ------------------------------------------------------------------


async def handle_get_room_state(params: dict, ctx: ToolHandlerContext) -> ToolResponse:
    """Return current room state from the session manager."""
    from server.api.room_manager import get_session_by_room

    room_id = params["room_id"]
    session = get_session_by_room(room_id)

    if session is None:
        return ToolResponse(call_id=ctx.call_id, success=False, error=f"Room not found: {room_id}")

    data: dict[str, Any] = {
        "roomId": room_id,
        "sessionId": session.session_id,
    }

    include = params.get("include") or ["participants"]

    if "participants" in include:
        data["participants"] = session.participants
        data["hostId"] = session.host_id

    return ToolResponse(call_id=ctx.call_id, success=True, data=data)
