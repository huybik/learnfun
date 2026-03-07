"""POST /api/ta — direct TA request (no NATS)."""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from server.agents.ta.agent import TAAgent
from server.agents.ta.models import TARequest
from server.logging import get_logger

log = get_logger("api:ta")
router = APIRouter()


class TARequestBody(BaseModel):
    requestId: str
    intent: str
    templateId: str | None = None
    context: dict = {}
    roomId: str
    userProfiles: list[dict] = []


@router.post("/ta")
async def post_ta(body: TARequestBody, request: Request):
    agent: TAAgent = request.app.state.ta_agent

    ta_request = TARequest(
        request_id=body.requestId,
        intent=body.intent,
        template_id=body.templateId,
        context=body.context,
        room_id=body.roomId,
        user_profiles=body.userProfiles,
    )

    log.info("API request received", request_id=ta_request.request_id, intent=ta_request.intent)

    try:
        response = await agent.handle_request(ta_request)
        status = 200 if response.success else 422
        if status == 422:
            raise HTTPException(status_code=422, detail=response.model_dump())
        return response.model_dump()
    except HTTPException:
        raise
    except Exception as exc:
        log.error("API request failed", error=str(exc))
        raise HTTPException(status_code=500, detail={"success": False, "error": str(exc)})
