"""Voice and language resolution for the AI Teacher."""

from __future__ import annotations

from typing import Optional

# ---------------------------------------------------------------------------
# Voices available to the AI teacher (Gemini Live API prebuilt voices)
# ---------------------------------------------------------------------------

TEACHER_VOICES = [
    {"value": "Aoede", "label": "Aoede (Female)"},
    {"value": "Charon", "label": "Charon (Male)"},
    {"value": "Fenrir", "label": "Fenrir (Male)"},
    {"value": "Kore", "label": "Kore (Female)"},
    {"value": "Leda", "label": "Leda (Female)"},
    {"value": "Orus", "label": "Orus (Male)"},
    {"value": "Puck", "label": "Puck (Male)"},
    {"value": "Zephyr", "label": "Zephyr (Female)"},
]

DEFAULT_TEACHER_VOICE = "Kore"

# ---------------------------------------------------------------------------
# Supported languages (BCP-47)
# ---------------------------------------------------------------------------

SUPPORTED_LANGUAGES = [
    {"value": "en-US", "label": "English (US)"},
    {"value": "vi-VN", "label": "Vietnamese"},
    {"value": "es-ES", "label": "Spanish (Spain)"},
    {"value": "fr-FR", "label": "French (France)"},
    {"value": "de-DE", "label": "German"},
    {"value": "ja-JP", "label": "Japanese"},
    {"value": "ko-KR", "label": "Korean"},
    {"value": "pt-BR", "label": "Portuguese (Brazil)"},
    {"value": "it-IT", "label": "Italian"},
    {"value": "ru-RU", "label": "Russian"},
    {"value": "zh-CN", "label": "Chinese (Mandarin, Simplified)"},
    {"value": "zh-TW", "label": "Chinese (Mandarin, Traditional)"},
    {"value": "hi-IN", "label": "Hindi (India)"},
    {"value": "ar-SA", "label": "Arabic (Saudi Arabia)"},
]

DEFAULT_LANGUAGE = "en-US"

_VOICE_VALUES = {v["value"] for v in TEACHER_VOICES}
_LANG_VALUES = {l["value"] for l in SUPPORTED_LANGUAGES}


def is_valid_voice(name: str) -> bool:
    return name in _VOICE_VALUES


def is_valid_language(code: str) -> bool:
    return code in _LANG_VALUES


def resolve_voice_config(
    voice: Optional[str] = None,
    language: Optional[str] = None,
) -> dict[str, str]:
    """Resolve voice + language, falling back to defaults for invalid values."""
    return {
        "voice": voice if voice and is_valid_voice(voice) else DEFAULT_TEACHER_VOICE,
        "language": language if language and is_valid_language(language) else DEFAULT_LANGUAGE,
    }
