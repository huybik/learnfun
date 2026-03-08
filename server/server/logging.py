import logging
import os
import sys

import structlog


def _resolve_log_level() -> int:
    raw_level = os.getenv("LOG_LEVEL", "DEBUG").upper()
    return getattr(logging, raw_level, logging.INFO)


_RESET = "\033[0m"
_RED = "\033[31m"
_ORANGE = "\033[33m"

_LEVEL_COLORS = {
    "error": _RED,
    "critical": _RED,
    "warning": _ORANGE,
}


def _colorize_by_level(
    logger: object, method_name: str, event_dict: dict
) -> dict:
    """Wrap the rendered JSON line in ANSI color for warning/error levels."""
    color = _LEVEL_COLORS.get(event_dict.get("level", ""))
    if color and sys.stderr.isatty():
        event_dict["_color"] = color
    return event_dict


def _render_colored(
    logger: object, method_name: str, event_dict: dict
) -> str:
    color = event_dict.pop("_color", None)
    line = structlog.processors.JSONRenderer()(logger, method_name, event_dict)
    if color:
        return f"{color}{line}{_RESET}"
    return line


structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", key="ts"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        _colorize_by_level,
        _render_colored,
    ],
    wrapper_class=structlog.make_filtering_bound_logger(_resolve_log_level()),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)


def get_logger(module: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(module=module)
