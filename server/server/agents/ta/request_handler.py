"""TA request handler — the full pipeline from intent to published bundle."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any

from server.content.models import FilledBundle
from server.logging import get_logger

from .models import TADependencies, TARequest, TAResponse
from .personalizer import adjust_difficulty, build_personalization_context

log = get_logger("ta:request-handler")


def _flatten_to_string_record(data: dict[str, Any]) -> dict[str, str]:
    """Flatten a dict into a string record for FilledBundle.filledSlots."""
    result: dict[str, str] = {}
    for key, value in data.items():
        result[key] = value if isinstance(value, str) else json.dumps(value)
    return result


async def handle_ta_request(
    req: TARequest,
    deps: TADependencies,
) -> TAResponse:
    """Main TA pipeline: query template -> personalize -> generate -> store -> publish."""
    start = time.monotonic()
    request_id = req.request_id
    intent = req.intent
    context = req.context
    room_id = req.room_id
    user_profiles = req.user_profiles

    log.info("Handling TA request", request_id=request_id, intent=intent, room_id=room_id)

    try:
        # 1. Query for a matching template
        template = await deps.query_template(intent)
        if template is None:
            return TAResponse(
                request_id=request_id,
                success=False,
                error=f'No template found for intent: "{intent}"',
                elapsed=_elapsed_ms(start),
            )

        log.debug(
            "Template selected",
            request_id=request_id,
            template_id=template.id,
            template_name=template.name,
        )

        # 2. Build personalization context
        personalization = build_personalization_context(user_profiles, intent)

        # 3. Determine difficulty
        difficulty_hint = ""
        if user_profiles:
            try:
                first_user_id = user_profiles[0].get("id", "")
                progress = await deps.get_learning_progress(first_user_id)
                adjustment = adjust_difficulty(template, progress)
                difficulty_hint = adjustment.hint
            except Exception:
                log.warning(
                    "Could not fetch learning progress, using default difficulty",
                    request_id=request_id,
                )

        # 4. Generate content
        from .models import GenerateParams

        filled_data = await deps.generator.generate_filled_data(
            GenerateParams(
                template=template,
                intent=intent,
                context=context,
                personalization_prompt=personalization.prompt_additions,
                difficulty_hint=difficulty_hint,
            )
        )

        # 5. Build bundle
        now = datetime.now(timezone.utc).isoformat()
        bundle = FilledBundle(
            templateId=template.id,
            sessionId=request_id,
            filledSlots=_flatten_to_string_record(filled_data),
            bundlePath="",
            createdAt=now,
        )

        # 6. Store bundle
        try:
            bundle.bundlePath = await deps.store_bundle(bundle)
        except Exception as exc:
            log.error("Failed to store bundle", request_id=request_id, error=str(exc))
            bundle.bundlePath = f"pending://{request_id}"

        # 7. Publish to room
        try:
            await deps.publish_to_room(room_id, {
                "type": "ta.content_ready",
                "timestamp": time.time(),
                "sourceId": "ta-agent",
                "payload": {
                    "contentId": request_id,
                    "bundlePath": bundle.bundlePath,
                    "metadata": {"intent": intent, "templateId": template.id},
                },
            })
        except Exception as exc:
            log.error(
                "Failed to publish to room",
                request_id=request_id,
                room_id=room_id,
                error=str(exc),
            )

        elapsed = _elapsed_ms(start)
        log.info("TA request completed", request_id=request_id, elapsed=elapsed)

        return TAResponse(
            request_id=request_id,
            success=True,
            bundle=bundle,
            filled_data=filled_data,
            elapsed=elapsed,
        )

    except Exception as exc:
        log.error("TA request failed", request_id=request_id, error=str(exc))
        return TAResponse(
            request_id=request_id,
            success=False,
            error=str(exc),
            elapsed=_elapsed_ms(start),
        )


def _elapsed_ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)
