"""Pydantic models matching the DB row shapes."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# --- User / Profile ---


class UserPreferences(BaseModel):
    voice: str = "Puck"
    language: str = "en-US"
    show_avatar: bool = True


class UserProfile(BaseModel):
    id: str
    name: str
    observations: list[str] = Field(default_factory=list)
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    created_at: str
    updated_at: str


# --- Learning Progress ---


class LearningProgress(BaseModel):
    user_id: str
    total_points: int = 0
    current_streak: int = 0
    highest_streak: int = 0
    unit_progress: dict[str, int] = Field(default_factory=dict)
    last_activity_at: str | None = None


# --- Session ---


class SessionRecord(BaseModel):
    id: str
    user_id: str
    room_id: str | None = None
    started_at: str
    ended_at: str | None = None
    activities: list[Any] = Field(default_factory=list)
    duration_seconds: int | None = None


# --- Room ---


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
