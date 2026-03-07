"""Pydantic models for the TA agent pipeline."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel

from server.content.models import FilledBundle, TemplateManifest


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
