"""Event-related models — not persisted, used for event publishing."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Participant(BaseModel):
    id: str
    name: str
    role: Literal["host", "student", "observer"]
    joined_at: str
    livekit_identity: str


class Room(BaseModel):
    id: str
    name: str
    host_id: str
    participants: list[Participant] = Field(default_factory=list)
    created_at: str
    active_content_id: str | None = None
