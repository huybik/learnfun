"""ContentGenerator — Gemini Flash content generation and template resolution."""

from __future__ import annotations

import json
import re
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

# Stopwords used in heuristic template matching
_STOPWORDS = frozenset([
    "a", "an", "the", "to", "for", "of", "and", "or", "in", "on", "with",
    "game", "lesson", "start", "load", "play",
])


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
                    session_id=params.intent,
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
    # resolve_template
    # ------------------------------------------------------------------

    async def resolve_template(
        self,
        intent: str,
        templates: list[TemplateManifest],
    ) -> Optional[str]:
        """Pick the best template for a plain-text intent. Heuristic first, AI fallback."""
        if not templates:
            return None
        if len(templates) == 1:
            return templates[0].id

        # Try heuristic first
        heuristic = self._resolve_template_heuristic(intent, templates)
        if heuristic:
            log.info("Heuristic resolved template", intent=intent, chosen=heuristic)
            return heuristic

        # AI fallback
        ids = [t.id for t in templates]
        catalog = "\n".join(
            f'- id: "{t.id}" | name: "{t.name}" | type: {t.type} | description: {t.description}'
            for t in templates
        )

        prompt = (
            "You are a template matcher. Given a user intent and a catalog of "
            "available templates, return the id of the single best matching template.\n\n"
            f"Catalog:\n{catalog}\n\n"
            f'User intent: "{intent}"\n\n'
            f'Return a JSON object: {{"id": "<template_id>"}} where template_id is one of: {", ".join(ids)}'
        )

        try:
            response = await self._client.aio.models.generate_content(
                model=self._model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0,
                    max_output_tokens=50,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "id": {"type": "STRING", "enum": ids},
                        },
                        "required": ["id"],
                    },
                ),
            )

            parsed = json.loads(response.text or "{}")

            try:
                log_ta_run(
                    session_id=f"resolve-{intent[:20]}",
                    prompt=prompt,
                    response={
                        "text": response.text,
                        "parsed": parsed,
                        "usage_metadata": str(getattr(response, "usage_metadata", None)),
                        "model": self._model,
                    },
                )
            except Exception:
                log.warning("Failed to write resolve run log")

            chosen = parsed.get("id")

            if chosen:
                # Exact match
                exact = next((t for t in templates if t.id == chosen), None)
                if exact:
                    log.info("AI resolved template", intent=intent, chosen=chosen)
                    return exact.id

                # Fuzzy match
                normalize = lambda s: re.sub(r"[-_\s]", "", s.lower())
                fuzzy = next(
                    (t for t in templates if normalize(t.id) == normalize(chosen)),
                    None,
                )
                if fuzzy:
                    log.info("AI resolved template (fuzzy)", intent=intent, chosen=chosen, matched=fuzzy.id)
                    return fuzzy.id

            log.warning("AI returned unknown template id", intent=intent, chosen=chosen, valid_ids=ids)
            fallback = self._resolve_template_heuristic(intent, templates)
            if fallback:
                log.info("Heuristic fallback resolved template", intent=intent, chosen=fallback)
                return fallback
            return None

        except Exception as exc:
            log.error("AI template resolution failed", error=str(exc))
            fallback = self._resolve_template_heuristic(intent, templates)
            if fallback:
                log.info("Heuristic fallback resolved template after AI error", intent=intent, chosen=fallback)
                return fallback
            return None

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

    def _resolve_template_heuristic(
        self,
        intent: str,
        templates: list[TemplateManifest],
    ) -> Optional[str]:
        normalized_intent = self._normalize(intent)
        intent_tokens = self._tokenize(intent)

        # Alias mapping
        aliases = [
            ("spaceshooter", ["space shooter", "spaceshooter", "shooter", "space game"]),
            ("solar-system", ["solar system", "planets", "space lesson", "astronomy"]),
            ("flashcard", ["flash card", "flashcard", "cards", "quiz"]),
            ("wordmatch", ["word match", "matching", "match words", "pair words"]),
            ("sentencebuilder", ["sentence builder", "build sentence", "complete sentence"]),
        ]

        for alias_id, keywords in aliases:
            if not any(self._normalize(k) in normalized_intent for k in keywords):
                continue
            direct = next((t for t in templates if self._normalize(t.id) == self._normalize(alias_id)), None)
            if direct:
                return direct.id

        # Generic lexical scoring
        best_id: Optional[str] = None
        best_score = 0

        for template in templates:
            haystack = f"{template.id} {template.name} {template.description}"
            template_tokens = self._tokenize(haystack)
            if not template_tokens:
                continue

            overlap = sum(1 for token in intent_tokens if token in template_tokens)
            if overlap > best_score:
                best_score = overlap
                best_id = template.id

        return best_id if best_score >= 2 else None

    @staticmethod
    def _normalize(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()

    @staticmethod
    def _tokenize(value: str) -> set[str]:
        normalized = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
        return {t for t in normalized.split() if len(t) > 1 and t not in _STOPWORDS}
