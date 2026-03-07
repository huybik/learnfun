"""Pydantic models for the TA agent pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

from pydantic import BaseModel

from server.content.models import FilledBundle, TemplateManifest
from server.storage.models import LearningProgress


# ---------------------------------------------------------------------------
# Request / Response
# ---------------------------------------------------------------------------


class TARequest(BaseModel):
    request_id: str
    intent: str
    context: dict[str, Any] = {}
    room_id: str
    user_profiles: list[dict[str, Any]] = []


class TAResponse(BaseModel):
    request_id: str
    success: bool
    bundle: Optional[FilledBundle] = None
    filled_data: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    elapsed: Optional[float] = None


# ---------------------------------------------------------------------------
# Generate params
# ---------------------------------------------------------------------------


class GenerateParams(BaseModel):
    template: TemplateManifest
    intent: str
    context: dict[str, Any] = {}
    personalization_prompt: Optional[str] = None
    difficulty_hint: Optional[str] = None


# ---------------------------------------------------------------------------
# Dependencies (injected into the request handler)
# ---------------------------------------------------------------------------


@dataclass
class TADependencies:
    generator: Any  # ContentGenerator (forward ref to avoid circular import)
    query_template: Callable[[str], Awaitable[Optional[TemplateManifest]]]
    store_bundle: Callable[[FilledBundle], Awaitable[str]]
    publish_to_room: Callable[[str, dict[str, Any]], Awaitable[None]]
    get_learning_progress: Callable[[str], Awaitable[LearningProgress]]
