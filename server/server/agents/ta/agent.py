"""TAAgent — lifecycle manager, called directly via handle_request()."""

from __future__ import annotations

from typing import Optional

from server.config import settings
from server.logging import get_logger

from .content_generator import ContentGenerator
from .models import TARequest, TAResponse
from .request_handler import handle_ta_request

log = get_logger("ta:agent")


class TAAgent:
    """TA agent lifecycle manager.

    No NATS — the agent is called directly via ``handle_request()``
    from the Teacher or an API route.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-flash-latest",
    ) -> None:
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._generator = ContentGenerator(self._api_key, model)
        self._running = False

    async def start(self) -> None:
        if self._running:
            log.warning("Agent already running")
            return
        self._running = True
        log.info("TA agent started")

    async def stop(self) -> None:
        self._running = False
        log.info("TA agent stopped")

    async def handle_request(self, req: TARequest) -> TAResponse:
        """Process a single TA request through the full pipeline."""
        log.info("Handling request", request_id=req.request_id, intent=req.intent, room_id=req.room_id)
        response = await handle_ta_request(req, self._generator)
        log.info("Request completed", request_id=req.request_id, success=response.success, elapsed=response.elapsed)
        return response
