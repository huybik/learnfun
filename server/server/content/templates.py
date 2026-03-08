from __future__ import annotations

import json
import re
from pathlib import Path

from server.config import settings
from server.content.models import GameMeta
from server.logging import get_logger

log = get_logger("template-registry")

SKILL_FILE = "skill.md"


def _data_dir() -> Path:
    return Path(settings.DATA_DIR)


def _parse_frontmatter(raw: str) -> dict:
    """Parse simple YAML-like frontmatter (key: value, with [list] support)."""
    result: dict = {}
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        value = value.strip()
        # Parse [list, items]
        if value.startswith("[") and value.endswith("]"):
            items = [s.strip() for s in value[1:-1].split(",")]
            result[key.strip()] = items
        # Parse numbers
        elif value.isdigit():
            result[key.strip()] = int(value)
        else:
            result[key.strip()] = value
    return result


def _parse_skill(path: Path) -> GameMeta:
    """Parse a skill.md file: frontmatter + markdown body."""
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.+?)\n---\n(.*)$", text, re.DOTALL)
    if not match:
        raise ValueError(f"No frontmatter in {path}")
    meta = _parse_frontmatter(match.group(1))
    meta["skill_text"] = match.group(2).strip()
    return GameMeta.model_validate(meta)


def list_games() -> list[GameMeta]:
    """Scan data/games/ for skill.md files."""
    games_dir = _data_dir() / "games"
    if not games_dir.is_dir():
        return []

    results: list[GameMeta] = []
    for subdir in sorted(games_dir.iterdir()):
        if not subdir.is_dir():
            continue
        skill_path = subdir / SKILL_FILE
        if not skill_path.exists():
            continue
        try:
            results.append(_parse_skill(skill_path))
        except Exception as exc:
            log.warning("Skipping invalid skill.md", path=str(skill_path), error=str(exc))

    log.debug("Listed games", count=len(results))
    return results


def get_game(game_id: str) -> GameMeta:
    """Get a single game by ID."""
    skill_path = _data_dir() / "games" / game_id / SKILL_FILE
    if not skill_path.exists():
        raise FileNotFoundError(f'Game not found: "{game_id}"')
    return _parse_skill(skill_path)
