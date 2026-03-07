"""TA request handler — the full pipeline from intent to published bundle."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from server.content.bundles import store_bundle as store_bundle_local
from server.content.models import FilledBundle, TemplateManifest
from server.content.templates import list_templates
from server.events.helpers import publish_event
from server.events.subjects import SUBJECTS, room_subject
from server.logging import get_logger
from server.storage.models import LearningProgress
from server.storage.queries.progress import get_progress

from .content_generator import ContentGenerator
from .models import GenerateParams, TARequest, TAResponse

log = get_logger("ta:request-handler")


# ---------------------------------------------------------------------------
# Personalization helpers
# ---------------------------------------------------------------------------


@dataclass
class PersonalizationContext:
    prompt_additions: str = ""
    applied_factors: list[str] = field(default_factory=list)


@dataclass
class DifficultyAdjustment:
    difficulty: str = "medium"  # "easy" | "medium" | "hard"
    hint: str = ""


def build_personalization_context(
    profiles: list[dict[str, Any]],
    intent: str,
) -> PersonalizationContext:
    """Combine user profiles into prompt-injectable context."""
    if not profiles:
        return PersonalizationContext()

    applied_factors: list[str] = []
    parts: list[str] = []

    # Merge observations
    all_observations: list[str] = []
    for p in profiles:
        all_observations.extend(p.get("observations", []))

    if all_observations:
        parts.append(f"Learner observations: {'; '.join(all_observations)}.")
        applied_factors.append("observations")

    # Interests
    interest_re = re.compile(r"enjoys|likes|loves|interested in", re.I)
    interests = [o for o in all_observations if interest_re.search(o)]
    if interests:
        parts.append(
            f"The learner's interests include: {', '.join(interests)}. "
            "Try to incorporate these themes."
        )
        applied_factors.append("interests")

    # Language
    prefs = profiles[0].get("preferences", {}) if profiles else {}
    primary_lang = prefs.get("language")
    if primary_lang:
        parts.append(f"Target language code: {primary_lang}.")
        applied_factors.append("language")

    # Names
    names = [p.get("name", "") for p in profiles if p.get("name")]
    if names:
        parts.append(
            f"Learner name(s): {', '.join(names)}. "
            "You can use their name occasionally for engagement."
        )
        applied_factors.append("names")

    prompt_additions = "\n".join(parts)

    log.debug(
        "Built personalization context",
        intent=intent,
        factor_count=len(applied_factors),
        applied_factors=applied_factors,
    )

    return PersonalizationContext(
        prompt_additions=prompt_additions,
        applied_factors=applied_factors,
    )


def adjust_difficulty(
    progress: LearningProgress,
) -> DifficultyAdjustment:
    """Determine difficulty based on learning progress."""
    completed_units = len(progress.unit_progress)
    total_points = progress.total_points

    if total_points < 50 and completed_units <= 1:
        difficulty = "easy"
        hint = "The learner is a beginner. Use simple vocabulary, short sentences, and generous hints."
    elif total_points < 200 or completed_units <= 3:
        difficulty = "medium"
        hint = "The learner has some experience. Use moderately complex vocabulary and provide occasional hints."
    else:
        difficulty = "hard"
        hint = "The learner is advanced. Use rich vocabulary, longer sentences, and fewer hints."

    # Streak bonus
    if progress.current_streak >= 5:
        hint += " The learner is on a streak — keep the energy high and pacing fast."

    log.debug(
        "Adjusted difficulty",
        difficulty=difficulty,
        total_points=total_points,
        completed_units=completed_units,
        streak=progress.current_streak,
    )

    return DifficultyAdjustment(difficulty=difficulty, hint=hint)


def _flatten_to_string_record(data: dict[str, Any]) -> dict[str, str]:
    """Flatten a dict into a string record for FilledBundle.filledSlots."""
    result: dict[str, str] = {}
    for key, value in data.items():
        result[key] = value if isinstance(value, str) else json.dumps(value)
    return result


async def handle_ta_request(
    req: TARequest,
    generator: ContentGenerator,
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
        template = await _query_template(generator, intent)
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
                progress = await _get_learning_progress(first_user_id)
                adjustment = adjust_difficulty(progress)
                difficulty_hint = adjustment.hint
            except Exception:
                log.warning(
                    "Could not fetch learning progress, using default difficulty",
                    request_id=request_id,
                )

        # 4. Generate content
        filled_data = await generator.generate_filled_data(
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
            bundle_id = store_bundle_local(bundle)
            bundle.bundlePath = bundle_id
            log.debug("store_bundle", bundle_id=bundle_id, template_id=bundle.templateId)
        except Exception as exc:
            log.error("Failed to store bundle", request_id=request_id, error=str(exc))
            bundle.bundlePath = f"pending://{request_id}"

        # 7. Publish to room
        try:
            channel = room_subject(SUBJECTS["CONTENT_PUSH"], room_id)
            await publish_event(
                channel=channel,
                event_type="ta.content_ready",
                payload={
                    "contentId": request_id,
                    "bundlePath": bundle.bundlePath,
                    "metadata": {"intent": intent, "templateId": template.id},
                },
                source_id="ta-agent",
            )
            log.debug("Published to room via Redis", room_id=room_id, channel=channel)
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


async def _query_template(
    generator: ContentGenerator,
    intent: str,
) -> TemplateManifest | None:
    """Resolve a template for the given intent."""
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


async def _get_learning_progress(user_id: str) -> LearningProgress:
    """Fetch learning progress, falling back to defaults on error."""
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


def _elapsed_ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)
