"""Shared SQL helper utilities for query modules."""

from __future__ import annotations

from typing import Any


def build_update_sql(
    table: str,
    fields: dict[str, Any],
    where_column: str,
    where_value: Any,
) -> tuple[str, list[Any]]:
    """Build a dynamic UPDATE statement from a dict of column=value pairs.

    Returns (sql_string, values_list) ready for ``pool.execute(sql, *values)``.
    Automatically appends ``updated_at = NOW()``.
    Returns ``("", [])`` when *fields* is empty (caller should skip the query).
    """
    if not fields:
        return "", []

    parts: list[str] = []
    values: list[Any] = []
    idx = 1

    for col, val in fields.items():
        parts.append(f"{col} = ${idx}")
        values.append(val)
        idx += 1

    parts.append("updated_at = NOW()")
    values.append(where_value)
    set_clause = ", ".join(parts)
    sql = f"UPDATE {table} SET {set_clause} WHERE {where_column} = ${idx}"
    return sql, values
