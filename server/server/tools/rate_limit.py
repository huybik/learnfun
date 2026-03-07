"""In-memory sliding-window rate limiter keyed by caller_id:tool_name."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from server.logging import get_logger

log = get_logger("tools.rate_limit")


@dataclass
class RateLimitConfig:
    max_calls: int = 30
    window_ms: int = 60_000  # 1 minute


@dataclass
class _Bucket:
    timestamps: list[float] = field(default_factory=list)


@dataclass
class RateLimitResult:
    allowed: bool
    retry_after_ms: float | None = None


class RateLimiter:
    """Simple sliding-window rate limiter (same logic as the TS original)."""

    def __init__(self, config: RateLimitConfig | None = None) -> None:
        self._config = config or RateLimitConfig()
        self._buckets: dict[str, _Bucket] = {}

    def check(self, caller_id: str, tool_name: str) -> RateLimitResult:
        """Check and record a call. Returns allowed or denied with retry_after_ms."""
        key = f"{caller_id}:{tool_name}"
        now = time.time() * 1000  # milliseconds
        window_start = now - self._config.window_ms

        bucket = self._buckets.get(key)
        if bucket is None:
            bucket = _Bucket()
            self._buckets[key] = bucket

        # Slide the window
        bucket.timestamps = [t for t in bucket.timestamps if t > window_start]

        if len(bucket.timestamps) >= self._config.max_calls:
            oldest = bucket.timestamps[0]
            retry_after_ms = max(oldest + self._config.window_ms - now, 0.0)
            log.warning(
                "Rate limit exceeded",
                caller_id=caller_id,
                tool_name=tool_name,
                count=len(bucket.timestamps),
                retry_after_ms=retry_after_ms,
            )
            return RateLimitResult(allowed=False, retry_after_ms=retry_after_ms)

        bucket.timestamps.append(now)
        return RateLimitResult(allowed=True)

    def reset(self) -> None:
        """Clear all buckets (useful for tests)."""
        self._buckets.clear()
