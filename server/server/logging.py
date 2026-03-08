import logging
import os

import structlog


def _resolve_log_level() -> int:
    raw_level = os.getenv("LOG_LEVEL", "DEBUG").upper()
    return getattr(logging, raw_level, logging.INFO)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", key="ts"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(_resolve_log_level()),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)


def get_logger(module: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(module=module)
