from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class GameMeta(BaseModel):
    """Metadata parsed from skill.md frontmatter."""
    id: str
    name: str
    tags: list[str] = []
    maxPlayers: int = 1
    skill_text: str = ""


class FilledBundle(BaseModel):
    templateId: str
    sessionId: str
    filledSlots: dict[str, str]
    createdAt: str
