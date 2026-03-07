"""TAAgent — lifecycle manager, called directly via handle_request()."""

from __future__ import annotations

from typing import Any, Optional

from server.config import settings
from server.content.bundles import store_bundle as store_bundle_local
from server.content.models import FilledBundle, TemplateManifest
from server.content.templates import list_templates
from server.events.redis_bridge import redis_bridge
from server.events.subjects import SUBJECTS, room_subject
from server.logging import get_logger
from server.storage.models import LearningProgress
from server.storage.queries.progress import get_progress

from .content_generator import ContentGenerator
from .models import TADependencies, TARequest, TAResponse
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
        deps = self._build_dependencies()
        return await handle_ta_request(req, deps)

    # ------------------------------------------------------------------
    # Dependency wiring
    # ------------------------------------------------------------------

    def _build_dependencies(self) -> TADependencies:
        generator = self._generator

        async def query_template(intent: str) -> Optional[TemplateManifest]:
            all_templates = list_templates()
            log.debug("query_template", intent=intent, available=len(all_templates))
            if not all_templates:
                return None

            chosen_id = await generator.resolve_template(intent, all_templates)
            if chosen_id:
                match = next((t for t in all_templates if t.id == chosen_id), None)
                if match:
                    return match

            log.warning("query_template: could not resolve", intent=intent)
            return None

        async def store_bundle(bundle: FilledBundle) -> str:
            bundle_id = store_bundle_local(bundle)
            log.debug("store_bundle", bundle_id=bundle_id, template_id=bundle.templateId)
            return bundle_id

        async def publish_to_room(room_id: str, event: dict[str, Any]) -> None:
            channel = room_subject(SUBJECTS["CONTENT_PUSH"], room_id)
            await redis_bridge.publish(channel, event)
            log.debug("Published to room via Redis", room_id=room_id, channel=channel)

        async def get_learning_progress(user_id: str) -> LearningProgress:
            try:
                progress = await get_progress(user_id)
                log.debug("get_learning_progress", user_id=user_id, total_points=progress.total_points)
                return progress
            except Exception as exc:
                log.warning(
                    "get_learning_progress: DB query failed, returning defaults",
                    user_id=user_id,
                    error=str(exc),
                )
                return LearningProgress(user_id=user_id)

        return TADependencies(
            generator=generator,
            query_template=query_template,
            store_bundle=store_bundle,
            publish_to_room=publish_to_room,
            get_learning_progress=get_learning_progress,
        )
