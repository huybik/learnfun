/**
 * React hook for shared cursor tracking.
 * Broadcasts local cursor via Yjs awareness, receives remote cursors.
 * Throttled to ~30fps.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Awareness } from "y-protocols/awareness";
import { createCursorSync, type CursorSyncHandle } from "../sync/cursor-sync";
import type { CursorPosition } from "@/types/room";

export interface UseCursorsResult {
  /** Map of remote user cursors. */
  cursors: Map<string, CursorPosition>;
  /** Call on local mouse/pointer move (normalized 0..1 coords). */
  updateCursor: (x: number, y: number) => void;
  /** Call when cursor leaves the canvas. */
  clearCursor: () => void;
}

/**
 * Shared cursor tracking hook.
 * Pass the awareness instance from the Yjs provider.
 */
export function useCursors(
  awareness: Awareness | null,
  userId: string,
  color: string,
): UseCursorsResult {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const handleRef = useRef<CursorSyncHandle | null>(null);

  useEffect(() => {
    if (!awareness) return;

    const handle = createCursorSync(awareness, userId, color);
    handleRef.current = handle;

    // Set initial state
    setCursors(handle.getCursors());

    const unsub = handle.onCursorsChange((updated) => {
      setCursors(new Map(updated));
    });

    return () => {
      unsub();
      handle.destroy();
      handleRef.current = null;
    };
  }, [awareness, userId, color]);

  const updateCursor = useCallback((x: number, y: number) => {
    handleRef.current?.setLocalCursor(x, y);
  }, []);

  const clearCursor = useCallback(() => {
    handleRef.current?.clearLocalCursor();
  }, []);

  return { cursors, updateCursor, clearCursor };
}
