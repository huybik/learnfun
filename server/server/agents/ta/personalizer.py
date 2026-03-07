"""Personalization helpers for the TA pipeline."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from server.content.models import TemplateManifest
from server.storage.models import LearningProgress
from server.logging import get_logger

log = get_logger("ta:personalizer")


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


@dataclass
class PersonalizationContext:
    prompt_additions: str = ""
    applied_factors: list[str] = field(default_factory=list)


@dataclass
class DifficultyAdjustment:
    difficulty: str = "medium"  # "easy" | "medium" | "hard"
    hint: str = ""


# ---------------------------------------------------------------------------
# build_personalization_context
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# adjust_difficulty
# ---------------------------------------------------------------------------


def adjust_difficulty(
    _template: TemplateManifest,
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
