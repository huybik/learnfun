"""ContentGenerator — Gemini Flash content generation."""

from __future__ import annotations

import json
import time
from typing import Any, Optional

from google import genai
from google.genai import types

from server.content.models import TemplateManifest
from server.logging import get_logger
from server.run_logger import log_ta_run

from .models import GenerateParams

log = get_logger("ta:content-generator")

FilledData = dict[str, Any]


class ContentGenerator:
    def __init__(self, api_key: str, model: str = "gemini-flash-latest") -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model

    # ------------------------------------------------------------------
    # generate_filled_data
    # ------------------------------------------------------------------

    async def generate_filled_data(self, params: GenerateParams) -> FilledData:
        """Call Gemini with structured JSON output matching the template slots."""
        template = params.template
        response_schema = self._build_response_schema(template)
        prompt = self._build_prompt(
            template,
            params.intent,
            params.context,
            params.personalization_prompt,
            params.difficulty_hint,
        )

        log.info(
            "Generating content",
            template_id=template.id,
            intent=params.intent,
            model=self._model,
            slot_count=len(template.slots),
        )

        start = time.monotonic()

        try:
            response = await self._client.aio.models.generate_content(
                model=self._model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=response_schema,
                    thinking_config=types.ThinkingConfig(thinking_level="low"),
                ),
            )

            elapsed = int((time.monotonic() - start) * 1000)
            log.info("Content generated", template_id=template.id, elapsed=elapsed)

            text = response.text
            if not text:
                raise ValueError("Gemini returned an empty response")

            parsed = json.loads(text)

            try:
                log_ta_run(
                    session_id=params.room_id or params.intent,
                    prompt=prompt,
                    response={
                        "text": text,
                        "parsed": parsed,
                        "usage_metadata": str(getattr(response, "usage_metadata", None)),
                        "model": self._model,
                        "template_id": template.id,
                        "elapsed_ms": elapsed,
                    },
                )
            except Exception:
                log.warning("Failed to write run log", template_id=template.id)

            return parsed
        except Exception as exc:
            elapsed = int((time.monotonic() - start) * 1000)
            log.error(
                "Content generation failed",
                template_id=template.id,
                elapsed=elapsed,
                error=str(exc),
            )
            raise RuntimeError(f"Content generation failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_response_schema(self, template: TemplateManifest) -> dict[str, Any]:
        properties: dict[str, Any] = {}
        required: list[str] = []

        for slot in template.slots:
            properties[slot.id] = {
                "type": "STRING",
                "description": slot.label,
            }
            if slot.required:
                required.append(slot.id)

        return {
            "type": "OBJECT",
            "properties": properties,
            "required": required,
        }

    def _build_prompt(
        self,
        template: TemplateManifest,
        intent: str,
        context: dict[str, Any],
        personalization_prompt: Optional[str],
        difficulty_hint: Optional[str],
    ) -> str:
        lines: list[str] = [
            "You are a content generator for an educational platform aimed at children.",
            f'Your task: fill the slots of the "{template.name}" template.',
            f"Template description: {template.description}",
            f"Template type: {template.type}",
            "",
            f"Intent: {intent}",
        ]

        if context:
            lines.extend(["", "Additional context:"])
            for key, value in context.items():
                lines.append(f"  - {key}: {json.dumps(value)}")

        lines.extend(["", "Slots to fill:"])
        for slot in template.slots:
            req_label = "(required)" if slot.required else "(optional)"
            default_note = f" [default: {slot.defaultValue}]" if slot.defaultValue else ""
            lines.append(f"  - {slot.id} ({slot.kind}) {req_label}: {slot.label}{default_note}")

        if personalization_prompt:
            lines.extend(["", "Personalization:", personalization_prompt])

        if difficulty_hint:
            lines.extend(["", f"Difficulty guidance: {difficulty_hint}"])

        if template.aiInstructions:
            lines.extend(["", f"Template instructions: {template.aiInstructions}"])

        lines.extend([
            "",
            "Return ONLY the JSON object with the filled slot values. Use plain text and emoji only, no URLs.",
        ])

        return "\n".join(lines)

