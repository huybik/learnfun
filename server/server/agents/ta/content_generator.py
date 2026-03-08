"""ContentGenerator — Gemini Flash content generation."""

from __future__ import annotations

import asyncio
import json
import time
import traceback
from typing import Any, Optional

from google import genai
from google.genai import types

from server.content.models import GameMeta
from server.logging import get_logger
from server.run_logger import log_ta_error, log_ta_run

from .models import GenerateParams

log = get_logger("ta:content-generator")

FilledData = dict[str, Any]

MAX_RETRIES = 3
BASE_DELAY = 1.0  # seconds


class ContentGenerator:
    def __init__(self, api_key: str, model: str = "gemini-flash-latest") -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model

    # ------------------------------------------------------------------
    # generate_filled_data
    # ------------------------------------------------------------------

    async def generate_filled_data(self, params: GenerateParams) -> FilledData:
        """Call Gemini to generate game data guided by skill.md."""
        game = params.game
        prompt = self._build_prompt(
            game,
            params.intent,
            params.context,
            params.personalization_prompt,
            params.difficulty_hint,
        )

        log.info(
            "Generating content",
            game_id=game.id,
            intent=params.intent,
            model=self._model,
        )

        last_exc: Exception | None = None
        session_id = params.room_id or params.intent

        for attempt in range(1, MAX_RETRIES + 1):
            start = time.monotonic()
            try:
                response = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        thinking_config=types.ThinkingConfig(thinking_level="low"),
                    ),
                )

                elapsed = int((time.monotonic() - start) * 1000)
                log.info("Content generated", game_id=game.id, elapsed=elapsed, attempt=attempt)

                text = response.text
                if not text:
                    raise ValueError("Gemini returned an empty response")

                parsed = json.loads(text)

                try:
                    log_ta_run(
                        session_id=session_id,
                        prompt=prompt,
                        response={
                            "text": text,
                            "parsed": parsed,
                            "usage_metadata": str(getattr(response, "usage_metadata", None)),
                            "model": self._model,
                            "game_id": game.id,
                            "elapsed_ms": elapsed,
                            "attempt": attempt,
                        },
                    )
                except Exception:
                    log.warning("Failed to write run log", game_id=game.id)

                return parsed

            except Exception as exc:
                elapsed = int((time.monotonic() - start) * 1000)
                last_exc = exc
                log.error(
                    "Content generation failed",
                    game_id=game.id,
                    elapsed=elapsed,
                    attempt=attempt,
                    max_retries=MAX_RETRIES,
                    error=str(exc),
                )
                try:
                    log_ta_error(
                        session_id=session_id,
                        error=str(exc),
                        context={
                            "game_id": game.id,
                            "intent": params.intent,
                            "model": self._model,
                            "attempt": attempt,
                            "elapsed_ms": elapsed,
                            "traceback": traceback.format_exc(),
                        },
                    )
                except Exception:
                    log.warning("Failed to write error log", game_id=game.id)

                if attempt < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** (attempt - 1))
                    log.info("Retrying after backoff", delay=delay, attempt=attempt)
                    await asyncio.sleep(delay)

        raise RuntimeError(f"Content generation failed after {MAX_RETRIES} attempts: {last_exc}") from last_exc

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_prompt(
        self,
        game: GameMeta,
        intent: str,
        context: dict[str, Any],
        personalization_prompt: Optional[str],
        difficulty_hint: Optional[str],
    ) -> str:
        lines: list[str] = [
            "You are a content generator for an educational platform aimed at children.",
            f'Your task: generate input data for the "{game.name}" game.',
            "",
            f"Intent: {intent}",
        ]

        if context:
            lines.extend(["", "Additional context:"])
            for key, value in context.items():
                lines.append(f"  - {key}: {json.dumps(value)}")

        if personalization_prompt:
            lines.extend(["", "Personalization:", personalization_prompt])

        if difficulty_hint:
            lines.extend(["", f"Difficulty guidance: {difficulty_hint}"])

        # Append the skill.md content — it contains the Input Data section
        # that tells Gemini exactly what JSON shape to produce
        if game.skill_text:
            lines.extend(["", "--- Game Skill Reference ---", game.skill_text])

        lines.extend([
            "",
            "Return ONLY a JSON object with a single key 'game_data' whose value is the game data JSON string. Use plain text and emoji only, no URLs.",
        ])

        return "\n".join(lines)
