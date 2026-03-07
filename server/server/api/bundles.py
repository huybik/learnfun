"""GET /api/bundles/{id} — serve a stored bundle by ID."""

from fastapi import APIRouter, HTTPException

from server.content.bundles import get_bundle
from server.logging import get_logger

log = get_logger("api:bundles")
router = APIRouter()


@router.get("/bundles/{bundle_id}")
async def get_bundle_by_id(bundle_id: str):
    try:
        bundle = get_bundle(bundle_id)
        return bundle.model_dump()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        log.error("Failed to get bundle", bundle_id=bundle_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to get bundle")
