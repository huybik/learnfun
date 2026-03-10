"""Tool definitions with Pydantic schemas (replaces Zod originals)."""

from __future__ import annotations

from typing import Any, Literal, Optional, get_args

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Caller identity
# ---------------------------------------------------------------------------

CallerRole = Literal["teacher", "ta"]


class CallerIdentity(BaseModel):
    id: str
    role: CallerRole
    session_id: str


# ---------------------------------------------------------------------------
# Tool names
# ---------------------------------------------------------------------------

ToolName = Literal[
    "request_ta_action",
    "query_content",
    "execute_filled_bundle",
    "light_control",
    "signal_feedback",
    "update_profile",
    "load_content",
    "get_room_state",
    "game_action",
]

TOOL_NAMES: list[str] = list(get_args(ToolName))


# ---------------------------------------------------------------------------
# Pydantic schemas for each tool's parameters
# ---------------------------------------------------------------------------

class RequestTaActionParams(BaseModel):
    intent: str = Field(min_length=1)
    template_id: Optional[str] = Field(default=None, alias="templateId")
    context: dict[str, Any] = Field(default_factory=dict)
    urgency: Literal["low", "normal", "high"] = "normal"

    model_config = {"populate_by_name": True}


class QueryContentParams(BaseModel):
    tags: Optional[list[str]] = None
    difficulty: Optional[str] = None
    user_context: Optional[dict[str, Any]] = Field(default=None, alias="userContext")

    model_config = {"populate_by_name": True}


class ExecuteFilledBundleParams(BaseModel):
    bundle_id: str = Field(min_length=1, alias="bundleId")
    room_id: str = Field(min_length=1, alias="roomId")
    filled_data: dict[str, Any] = Field(alias="filledData")

    model_config = {"populate_by_name": True}


class LightControlParams(BaseModel):
    action: Literal["highlight", "focus", "emote", "pause", "resume"] = Field(
        description=(
            "highlight/focus: draw attention to a screen region (requires x, y). "
            "emote: show an emoji animation (requires emoji). "
            "pause: pause the lesson (mute mic+speaker). "
            "resume: resume the lesson (unmute mic+speaker)."
        )
    )
    x: Optional[float] = Field(default=None, description="Horizontal position 0-1, required for highlight/focus")
    y: Optional[float] = Field(default=None, description="Vertical position 0-1, required for highlight/focus")
    emoji: Optional[str] = Field(default=None, description="Emoji character, required for emote")


class SignalFeedbackParams(BaseModel):
    type: Literal["correct", "incorrect", "info"]
    points: Optional[int] = None
    message: Optional[str] = None


class UpdateProfileParams(BaseModel):
    observation: str = Field(min_length=1)


class LoadContentParams(BaseModel):
    content_type: Literal["game", "bundle"] = Field(alias="contentType")
    content_id: str = Field(min_length=1, alias="contentId")

    model_config = {"populate_by_name": True}


class GetRoomStateParams(BaseModel):
    room_id: str = Field(min_length=1, alias="roomId")
    include: Optional[list[Literal["participants", "content", "annotations", "cursors"]]] = None

    model_config = {"populate_by_name": True}


class GameActionParams(BaseModel):
    action: str = Field(min_length=1, description="The action name declared in the game's skill.md Actions section")
    params: dict[str, Any] = Field(default_factory=dict, description="Action parameters")


# ---------------------------------------------------------------------------
# Tool call & response types
# ---------------------------------------------------------------------------

class ToolCall(BaseModel):
    id: str
    tool: ToolName
    params: dict[str, Any]
    caller: CallerIdentity
    timestamp: float


class ToolResponse(BaseModel):
    call_id: str
    success: bool
    data: Optional[dict[str, Any]] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Tool handler context
# ---------------------------------------------------------------------------

class ToolHandlerContext(BaseModel):
    caller: CallerIdentity
    call_id: str
    timestamp: float


# ---------------------------------------------------------------------------
# Tool registration (definition + access control)
# ---------------------------------------------------------------------------

class ToolRegistration(BaseModel):
    name: ToolName
    description: str
    schema_cls: type[BaseModel]
    allowed_callers: list[CallerRole]

    model_config = {"arbitrary_types_allowed": True}


# ---------------------------------------------------------------------------
# TOOL_DEFINITIONS
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS: list[ToolRegistration] = [
    ToolRegistration(
        name="request_ta_action",
        description=(
            "Delegate an action to the Teaching Assistant. The Teacher uses "
            "this to wake up the TA with an intent and context."
        ),
        schema_cls=RequestTaActionParams,
        allowed_callers=["teacher"],
    ),
    ToolRegistration(
        name="query_content",
        description=(
            "Search for available games by tags. Returns matching games "
            "from the registry."
        ),
        schema_cls=QueryContentParams,
        allowed_callers=["ta"],
    ),
    ToolRegistration(
        name="execute_filled_bundle",
        description=(
            "Push a filled content bundle to the live room. Stores the "
            "bundle and notifies room participants."
        ),
        schema_cls=ExecuteFilledBundleParams,
        allowed_callers=["ta"],
    ),
    ToolRegistration(
        name="light_control",
        description=(
            "Control the classroom UI. Actions: "
            "highlight/focus (point at screen region), "
            "emote (show emoji animation), "
            "pause/resume (mute/unmute the lesson)."
        ),
        schema_cls=LightControlParams,
        allowed_callers=["teacher"],
    ),
    ToolRegistration(
        name="signal_feedback",
        description=(
            "Show visual feedback to the user: correct, incorrect, or "
            "informational. Optionally awards points."
        ),
        schema_cls=SignalFeedbackParams,
        allowed_callers=["teacher", "ta"],
    ),
    ToolRegistration(
        name="update_profile",
        description=(
            "Record a learning observation about the user (e.g. 'struggles "
            "with past tense', 'enjoys animals')."
        ),
        schema_cls=UpdateProfileParams,
        allowed_callers=["teacher", "ta"],
    ),
    ToolRegistration(
        name="load_content",
        description=(
            "Load a content item (game metadata or filled bundle) into "
            "the current session."
        ),
        schema_cls=LoadContentParams,
        allowed_callers=["teacher", "ta"],
    ),
    ToolRegistration(
        name="get_room_state",
        description=(
            "Retrieve the current state of a collaborative room, including "
            "participants, active content, annotations, and cursors."
        ),
        schema_cls=GetRoomStateParams,
        allowed_callers=["teacher", "ta"],
    ),
    ToolRegistration(
        name="game_action",
        description=(
            "Invoke an action on the currently active game. Actions are declared "
            "in the game's skill.md Actions section. Both Player and Teacher "
            "actions are available. Use this to interact with the game directly "
            "(e.g. select a planet, reveal an answer, skip to a phase)."
        ),
        schema_cls=GameActionParams,
        allowed_callers=["teacher"],
    ),
]
