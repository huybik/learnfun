from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class TemplateSlot(BaseModel):
    id: str
    kind: Literal["text", "image", "audio", "video"]
    label: str
    required: bool
    defaultValue: Optional[str] = None


class TemplateManifest(BaseModel):
    id: str
    name: str
    description: str
    type: Literal["lesson", "game"]
    version: int
    slots: list[TemplateSlot]
    bundlePath: str
    thumbnailUrl: Optional[str] = None
    tags: Optional[list[str]] = None
    aiInstructions: Optional[str] = None
    createdAt: str
    updatedAt: str


class LessonTemplate(TemplateManifest):
    type: Literal["lesson"] = "lesson"
    lessonKind: Optional[str] = None
    pages: int
    unitId: str


class GamePodTemplate(TemplateManifest):
    type: Literal["game"] = "game"
    gameKind: Literal[
        "wordmatch", "flashcard", "sentencebuilder", "spaceshooter", "freeform"
    ]
    minPlayers: int
    maxPlayers: int


class FilledBundle(BaseModel):
    templateId: str
    sessionId: str
    filledSlots: dict[str, str]
    bundlePath: str
    createdAt: str
