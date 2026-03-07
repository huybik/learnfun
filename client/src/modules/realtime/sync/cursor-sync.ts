/**
 * Cursor position sync via Yjs awareness protocol.
 * Broadcasts local cursor position and collects remote cursors.
 * Throttled to ~30fps to avoid flooding the network.
 */

import type { Awareness } from "y-protocols/awareness";
import type { CursorPosition } from "@/types/room";

/** Throttle interval for cursor updates (~30fps). */
const CURSOR_THROTTLE_MS = 33;

export interface CursorSyncHandle {
  /** Update local cursor position. Throttled internally. */
  setLocalCursor: (x: number, y: number) => void;
  /** Clear local cursor (e.g. mouse leaves canvas). */
  clearLocalCursor: () => void;
  /** Subscribe to remote cursor changes. Returns unsubscribe function. */
  onCursorsChange: (cb: (cursors: Map<string, CursorPosition>) => void) => () => void;
  /** Get current snapshot of all remote cursors. */
  getCursors: () => Map<string, CursorPosition>;
  destroy: () => void;
}

/**
 * Create a cursor sync handle that uses Yjs awareness for broadcasting.
 */
export function createCursorSync(
  awareness: Awareness,
  userId: string,
  _color: string,
): CursorSyncHandle {
  let lastSent = 0;
  let pendingUpdate: { x: number; y: number } | null = null;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(cursors: Map<string, CursorPosition>) => void>();

  function sendCursor(x: number, y: number) {
    const cursor: CursorPosition = { userId, x, y, updatedAt: Date.now() };
    const current = awareness.getLocalState() ?? {};
    awareness.setLocalState({ ...current, cursor });
  }

  function setLocalCursor(x: number, y: number) {
    const now = Date.now();
    if (now - lastSent >= CURSOR_THROTTLE_MS) {
      lastSent = now;
      sendCursor(x, y);
    } else {
      // Queue the latest position
      pendingUpdate = { x, y };
      if (!throttleTimer) {
        const remaining = CURSOR_THROTTLE_MS - (now - lastSent);
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          if (pendingUpdate) {
            lastSent = Date.now();
            sendCursor(pendingUpdate.x, pendingUpdate.y);
            pendingUpdate = null;
          }
        }, remaining);
      }
    }
  }

  function clearLocalCursor() {
    const current = awareness.getLocalState() ?? {};
    awareness.setLocalState({ ...current, cursor: null });
    pendingUpdate = null;
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
  }

  function collectRemoteCursors(): Map<string, CursorPosition> {
    const cursors = new Map<string, CursorPosition>();
    awareness.getStates().forEach((state, clientId) => {
      // Skip our own client
      if (clientId === awareness.clientID) return;
      const cursor = state.cursor as CursorPosition | null | undefined;
      if (cursor?.userId) {
        cursors.set(cursor.userId, cursor);
      }
    });
    return cursors;
  }

  function handleAwarenessChange() {
    const cursors = collectRemoteCursors();
    listeners.forEach((cb) => cb(cursors));
  }

  awareness.on("change", handleAwarenessChange);

  function onCursorsChange(cb: (cursors: Map<string, CursorPosition>) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  function destroy() {
    clearLocalCursor();
    awareness.off("change", handleAwarenessChange);
    listeners.clear();
  }

  return {
    setLocalCursor,
    clearLocalCursor,
    onCursorsChange,
    getCursors: collectRemoteCursors,
    destroy,
  };
}
