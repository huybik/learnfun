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
]

TOOL_NAMES: list[str] = list(get_args(ToolName))


# ---------------------------------------------------------------------------
# Pydantic schemas for each tool's parameters
# ---------------------------------------------------------------------------

class RequestTaActionParams(BaseModel):
    intent: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)
    urgency: Literal["low", "normal", "high"] = "normal"


class QueryContentParams(BaseModel):
    type: Literal["lesson", "game"]
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
    action: Literal["highlight", "pause", "resume", "emote", "focus"]
    params: dict[str, Any] = Field(default_factory=dict)


class SignalFeedbackParams(BaseModel):
    type: Literal["correct", "incorrect", "info"]
    points: Optional[int] = None
    message: Optional[str] = None


class UpdateProfileParams(BaseModel):
    observation: str = Field(min_length=1)


class LoadContentParams(BaseModel):
    content_type: Literal["unit", "template", "bundle"] = Field(alias="contentType")
    content_id: str = Field(min_length=1, alias="contentId")
    page: Optional[int] = Field(default=None, ge=1)

    model_config = {"populate_by_name": True}


class GetRoomStateParams(BaseModel):
    room_id: str = Field(min_length=1, alias="roomId")
    include: Optional[list[Literal["participants", "content", "annotations", "cursors"]]] = None

    model_config = {"populate_by_name": True}


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
            "Search for matching lesson or game templates. The TA uses this "
            "to find content that fits the current learning context."
        ),
        schema_cls=QueryContentParams,
        allowed_callers=["ta"],
    ),
    ToolRegistration(
        name="execute_filled_bundle",
        description=(
            "Push a filled content bundle to the live room. Validates data "
            "against the template schema, stores the bundle, and notifies "
            "room participants."
        ),
        schema_cls=ExecuteFilledBundleParams,
        allowed_callers=["ta"],
    ),
    ToolRegistration(
        name="light_control",
        description=(
            "Manipulate the classroom UI: highlight elements, pause/resume "
            "activity, trigger avatar emotes, or focus on a region."
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
            "Load a content item (unit, template, or filled bundle) into "
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
]
