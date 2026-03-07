"""Central tool registry: register handlers, execute with auth + rate-limit + validate pipeline."""

from __future__ import annotations

import time
import uuid
from typing import Any, Awaitable, Callable

from pydantic import BaseModel, ValidationError

from server.logging import get_logger
from .auth import validate_caller
from .rate_limit import RateLimiter
from .schemas import (
    TOOL_DEFINITIONS,
    CallerIdentity,
    CallerRole,
    ToolHandlerContext,
    ToolName,
    ToolResponse,
)

log = get_logger("tools.registry")

# Handler signature: async (params: dict, context: ToolHandlerContext) -> ToolResponse
ToolHandler = Callable[[dict[str, Any], ToolHandlerContext], Awaitable[ToolResponse]]


class _RegisteredTool:
    __slots__ = ("name", "description", "schema_cls", "allowed_callers", "handler")

    def __init__(
        self,
        name: ToolName,
        description: str,
        schema_cls: type[BaseModel],
        allowed_callers: list[CallerRole],
        handler: ToolHandler,
    ) -> None:
        self.name = name
        self.description = description
        self.schema_cls = schema_cls
        self.allowed_callers = allowed_callers
        self.handler = handler


class ToolListEntry(BaseModel):
    name: ToolName
    description: str
    allowed_callers: list[CallerRole]


class ToolRegistry:
    """
    Register tool handlers and execute them through the pipeline:
      1. Existence check
      2. Caller authorisation
      3. Rate limiting
      4. Pydantic input validation
      5. Handler invocation
    """

    def __init__(self, rate_limiter: RateLimiter | None = None) -> None:
        self._tools: dict[ToolName, _RegisteredTool] = {}
        self._rate_limiter = rate_limiter or RateLimiter()

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, name: ToolName, handler: ToolHandler) -> "ToolRegistry":
        """Register a handler for *name*. The tool must exist in TOOL_DEFINITIONS."""
        definition = next((d for d in TOOL_DEFINITIONS if d.name == name), None)
        if definition is None:
            raise ValueError(
                f"Cannot register unknown tool '{name}'. Add it to TOOL_DEFINITIONS first."
            )

        if name in self._tools:
            log.warning("Overwriting handler for tool", name=name)

        self._tools[name] = _RegisteredTool(
            name=definition.name,
            description=definition.description,
            schema_cls=definition.schema_cls,
            allowed_callers=list(definition.allowed_callers),
            handler=handler,
        )

        log.info("Tool registered", name=name)
        return self

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------

    async def execute(
        self,
        name: ToolName,
        params: dict[str, Any],
        caller: CallerIdentity,
    ) -> ToolResponse:
        """Run the full execute pipeline for a tool call."""
        call_id = f"call-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
        timestamp = time.time()

        log.debug("Tool call received", call_id=call_id, name=name, caller_role=caller.role)

        # 1. Check tool exists
        tool = self._tools.get(name)  # type: ignore[arg-type]
        if tool is None:
            log.warning("Tool not found", call_id=call_id, name=name)
            return ToolResponse(call_id=call_id, success=False, error=f"Unknown tool: {name}")

        # 2. Auth check
        auth = validate_caller(name, caller)
        if not auth.allowed:
            return ToolResponse(call_id=call_id, success=False, error=auth.reason)

        # 3. Rate limit
        rate_check = self._rate_limiter.check(caller.id, name)
        if not rate_check.allowed:
            retry_ms = getattr(rate_check, "retry_after_ms", 0)
            return ToolResponse(
                call_id=call_id,
                success=False,
                error=f"Rate limit exceeded for '{name}'. Retry after {retry_ms}ms.",
            )

        # 4. Validate input
        try:
            validated = tool.schema_cls.model_validate(params)
        except ValidationError as exc:
            log.warning("Validation failed", call_id=call_id, name=name, errors=str(exc))
            return ToolResponse(
                call_id=call_id,
                success=False,
                error=f"Validation error: {exc}",
            )

        # 5. Execute handler
        context = ToolHandlerContext(caller=caller, call_id=call_id, timestamp=timestamp)
        try:
            response = await tool.handler(validated.model_dump(), context)
            log.info("Tool call completed", call_id=call_id, name=name, success=response.success)
            return response
        except Exception as exc:
            log.error("Tool handler threw", call_id=call_id, name=name, error=str(exc))
            return ToolResponse(
                call_id=call_id, success=False, error=f"Internal error: {exc}"
            )

    # ------------------------------------------------------------------
    # Listing
    # ------------------------------------------------------------------

    def list_tools(self, caller: CallerIdentity) -> list[ToolListEntry]:
        """Return tool definitions visible to *caller* based on role."""
        entries: list[ToolListEntry] = []
        for tool in self._tools.values():
            if caller.role in tool.allowed_callers:
                entries.append(
                    ToolListEntry(
                        name=tool.name,
                        description=tool.description,
                        allowed_callers=tool.allowed_callers,
                    )
                )
        return entries

    def has(self, name: ToolName) -> bool:
        """Check whether a handler has been registered for *name*."""
        return name in self._tools
