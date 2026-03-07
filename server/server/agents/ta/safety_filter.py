"""Content safety validation for child-facing generated content."""

from __future__ import annotations

import re
from typing import Any, Literal
from urllib.parse import urlparse

from server.logging import get_logger

log = get_logger("ta:safety-filter")

AgeGroup = Literal["young", "middle", "teen"]


class SafetyResult:
    __slots__ = ("passed", "reasons")

    def __init__(self, passed: bool, reasons: list[str]) -> None:
        self.passed = passed
        self.reasons = reasons


# ---------------------------------------------------------------------------
# Blocklists
# ---------------------------------------------------------------------------

BLOCKED_PATTERNS: list[re.Pattern[str]] = [
    # Violence
    re.compile(r"\b(kill|murder|blood|gore|weapon|gun|knife|stab|shoot)\b", re.I),
    # Profanity
    re.compile(r"\b(damn|hell|shit|fuck|ass|bitch|crap)\b", re.I),
    # Adult/sexual
    re.compile(r"\b(sex|nude|naked|porn|drug|alcohol|beer|wine|cigarette|vape)\b", re.I),
    # Self-harm
    re.compile(r"\b(suicide|self[- ]?harm|cut myself)\b", re.I),
    # Hate speech
    re.compile(r"\b(hate|racist|sexist)\b", re.I),
]

YOUNG_BLOCKED_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\b(scary|horror|monster|death|dead|die|dying)\b", re.I),
    re.compile(r"\b(fight|punch|kick|hit|hurt)\b", re.I),
]

TRUSTED_URL_HOSTS: list[re.Pattern[str]] = [
    re.compile(r"^localhost(:\d+)?$"),
    re.compile(r"\.eduforge\.", re.I),
    re.compile(r"\.googleapis\.com$", re.I),
    re.compile(r"\.googleusercontent\.com$", re.I),
    re.compile(r"storage\.googleapis\.com$", re.I),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.I)


def _extract_urls(text: str) -> list[str]:
    return _URL_RE.findall(text)


def _is_url_trusted(url: str) -> bool:
    try:
        hostname = urlparse(url).hostname or ""
        return any(p.search(hostname) for p in TRUSTED_URL_HOSTS)
    except Exception:
        return False


def _collect_text_values(data: Any) -> list[str]:
    texts: list[str] = []

    def walk(value: Any) -> None:
        if isinstance(value, str):
            texts.append(value)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, dict):
            for v in value.values():
                walk(v)

    walk(data)
    return texts


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_content(
    filled_data: dict[str, Any],
    age_group: AgeGroup = "young",
) -> SafetyResult:
    """Validate generated content for safety before delivering to children."""
    reasons: list[str] = []
    all_texts = _collect_text_values(filled_data)
    combined = " ".join(all_texts)

    # 1. Blocked patterns
    patterns = (
        BLOCKED_PATTERNS + YOUNG_BLOCKED_PATTERNS
        if age_group == "young"
        else BLOCKED_PATTERNS
    )
    for pattern in patterns:
        match = pattern.search(combined)
        if match:
            reasons.append(f'Blocked content detected: "{match.group(0)}"')

    # 2. Untrusted URLs
    for url in _extract_urls(combined):
        if not _is_url_trusted(url):
            reasons.append(f"Untrusted URL: {url}")

    # 3. Empty content
    if len(all_texts) == 0:
        reasons.append("Generated content is empty")

    passed = len(reasons) == 0

    if not passed:
        log.warning("Content failed safety check", age_group=age_group, reasons=reasons)
    else:
        log.debug("Content passed safety check", age_group=age_group)

    return SafetyResult(passed=passed, reasons=reasons)
