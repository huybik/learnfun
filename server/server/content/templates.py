from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from server.config import settings
from server.content.models import (
    GamePodTemplate,
    LessonTemplate,
    TemplateManifest,
)
from server.logging import get_logger

log = get_logger("template-registry")

MANIFEST_FILE = "manifest.json"


def _data_dir() -> Path:
    return Path(settings.DATA_DIR)


def _dirs_for_type(
    type_filter: Optional[str],
) -> list[Path]:
    """Return directories to scan for the given type filter."""
    dirs: list[Path] = []
    if not type_filter or type_filter == "game":
        dirs.append(_data_dir() / "games")
    if not type_filter or type_filter == "lesson":
        dirs.append(_data_dir() / "lessons")
    return dirs


def _parse_manifest(raw: dict) -> TemplateManifest:
    """Validate a manifest dict into the correct model subtype."""
    if raw.get("type") == "lesson":
        return LessonTemplate.model_validate(raw)
    return GamePodTemplate.model_validate(raw)


def list_templates(
    type_filter: Optional[str] = None,
) -> list[TemplateManifest]:
    """Scan data/games/ and data/lessons/ for manifest.json files."""
    manifests: list[TemplateManifest] = []

    for dir_path in _dirs_for_type(type_filter):
        if not dir_path.is_dir():
            continue
        for subdir in sorted(dir_path.iterdir()):
            if not subdir.is_dir():
                continue
            manifest_path = subdir / MANIFEST_FILE
            if not manifest_path.exists():
                continue
            try:
                raw = json.loads(manifest_path.read_text())
                manifest = _parse_manifest(raw)
                if not type_filter or manifest.type == type_filter:
                    manifests.append(manifest)
            except Exception as exc:
                log.warning(
                    "Skipping invalid manifest",
                    path=str(manifest_path),
                    error=str(exc),
                )

    log.debug("Listed templates", count=len(manifests), type=type_filter or "all")
    return manifests


def get_template(template_id: str) -> TemplateManifest:
    """Get a single template manifest by ID. Searches games/ then lessons/."""
    for dir_path in _dirs_for_type(None):
        manifest_path = dir_path / template_id / MANIFEST_FILE
        if not manifest_path.exists():
            continue
        raw = json.loads(manifest_path.read_text())
        return _parse_manifest(raw)

    raise FileNotFoundError(f'Template not found: "{template_id}"')
