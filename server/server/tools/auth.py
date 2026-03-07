"""Caller authorisation for tool invocations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from server.logging import get_logger
from .schemas import TOOL_DEFINITIONS, CallerIdentity, CallerRole, ToolName

log = get_logger("tools.auth")


@dataclass
class AuthResult:
    allowed: bool
    reason: Optional[str] = None


def validate_caller(tool_name: ToolName, caller: CallerIdentity) -> AuthResult:
    """Check whether *caller* has permission to invoke *tool_name*."""
    definition = next((d for d in TOOL_DEFINITIONS if d.name == tool_name), None)

    if definition is None:
        log.warning("Auth check for unknown tool", tool_name=tool_name, caller_id=caller.id)
        return AuthResult(allowed=False, reason=f"Unknown tool: {tool_name}")

    if caller.role not in definition.allowed_callers:
        log.warning(
            "Caller not authorised for tool",
            tool_name=tool_name,
            caller_role=caller.role,
            caller_id=caller.id,
            allowed=definition.allowed_callers,
        )
        return AuthResult(
            allowed=False,
            reason=(
                f"Role '{caller.role}' is not allowed to call '{tool_name}'. "
                f"Allowed: {', '.join(definition.allowed_callers)}"
            ),
        )

    return AuthResult(allowed=True)


def tools_for_role(role: CallerRole) -> list[ToolName]:
    """Return tool names a given role is permitted to use."""
    return [d.name for d in TOOL_DEFINITIONS if role in d.allowed_callers]
