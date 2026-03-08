"""Serve built game files from data/games/{id}/dist/."""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse, Response

router = APIRouter()

GAMES_DIR = Path(__file__).resolve().parents[3] / "data" / "games"

# MIME types for common game assets
_MIME = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
}


@router.get("/games/{game_id}/{file_path:path}")
async def serve_game(game_id: str, file_path: str = ""):
    """Serve a file from a game's dist directory."""
    if not file_path or file_path.endswith("/"):
        file_path = "index.html"

    full_path = (GAMES_DIR / game_id / "dist" / file_path).resolve()

    # Prevent path traversal
    if not str(full_path).startswith(str(GAMES_DIR)):
        return Response(status_code=403)

    if not full_path.is_file():
        return Response(status_code=404)

    media_type = _MIME.get(full_path.suffix, "application/octet-stream")
    return FileResponse(full_path, media_type=media_type)
