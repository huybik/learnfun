from __future__ import annotations

import json
from pathlib import Path

from server.config import settings
from server.content.models import FilledBundle
from server.logging import get_logger

log = get_logger("bundle-builder")


def _bundles_dir() -> Path:
    return Path(settings.DATA_DIR) / "bundles"


def store_bundle(bundle: FilledBundle) -> str:
    """Write a filled bundle to data/bundles/{sessionId}/bundle.json. Returns the sessionId."""
    bundle_path = _bundles_dir() / bundle.sessionId / "bundle.json"
    bundle_path.parent.mkdir(parents=True, exist_ok=True)
    bundle_path.write_text(bundle.model_dump_json(indent=2))

    log.info("Bundle stored", bundle_id=bundle.sessionId, path=str(bundle_path))
    return bundle.sessionId


def get_bundle(bundle_id: str) -> FilledBundle:
    """Read a filled bundle by its ID."""
    bundle_path = _bundles_dir() / bundle_id / "bundle.json"

    if not bundle_path.exists():
        raise FileNotFoundError(f'Bundle not found: "{bundle_id}"')

    raw = json.loads(bundle_path.read_text())
    return FilledBundle.model_validate(raw)


def list_bundles() -> list[FilledBundle]:
    """List all stored bundles."""
    bundles_dir = _bundles_dir()
    if not bundles_dir.is_dir():
        return []

    bundles: list[FilledBundle] = []
    for subdir in sorted(bundles_dir.iterdir()):
        bundle_path = subdir / "bundle.json"
        if not bundle_path.exists():
            continue
        try:
            raw = json.loads(bundle_path.read_text())
            bundles.append(FilledBundle.model_validate(raw))
        except Exception as exc:
            log.warning(
                "Skipping invalid bundle",
                path=str(bundle_path),
                error=str(exc),
            )

    log.debug("Listed bundles", count=len(bundles))
    return bundles
