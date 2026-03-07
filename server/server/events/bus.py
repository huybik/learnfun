"""InProcessBus — lightweight asyncio pub/sub for in-process agent communication."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, Callable, Awaitable

from server.logging import get_logger

log = get_logger("bus")

Handler = Callable[[Any, str], Awaitable[None] | None]


class InProcessBus:
    """Simple in-memory publish/subscribe using asyncio.

    Used for room-scoped events (UI control, content push) where both
    publisher and subscriber live in the same process.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = defaultdict(list)

    def subscribe(self, channel: str, handler: Handler) -> Callable[[], None]:
        """Register *handler* for *channel*. Returns an unsubscribe callable."""
        self._handlers[channel].append(handler)
        log.info("subscribed", channel=channel)

        def _unsub() -> None:
            try:
                self._handlers[channel].remove(handler)
            except ValueError:
                pass

        return _unsub

    async def publish(self, channel: str, data: Any) -> None:
        """Publish *data* to all handlers registered on *channel*."""
        handlers = list(self._handlers.get(channel, []))
        for handler in handlers:
            try:
                result = handler(data, channel)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                log.exception("handler_error", channel=channel)
        log.debug("published", channel=channel, handler_count=len(handlers))


# Module-level singleton
bus = InProcessBus()
