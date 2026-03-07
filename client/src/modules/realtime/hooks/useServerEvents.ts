/**
 * SSE hook: connects to /api/room/{roomId}/events and dispatches
 * server-sent events to handler callbacks.
 * Replaces useNatsEvents — same interface, same SSE transport.
 */

import { useEffect, useRef, useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentReadyPayload {
  type: "ta.content_ready";
  payload: {
    contentId: string;
    bundlePath: string;
    metadata?: Record<string, unknown>;
  };
}

export interface TranscriptPayload {
  source: "user" | "ai";
  text: string;
}

export interface UIControlPayload {
  type: string;
  payload: Record<string, unknown>;
}

export interface ServerEventHandlers {
  onContentReady?: (data: ContentReadyPayload) => void;
  onTranscript?: (data: TranscriptPayload) => void;
  onUIControl?: (data: UIControlPayload) => void;
  onGameStarted?: (data: unknown) => void;
  onGameEnded?: (data: unknown) => void;
}

export interface UseServerEventsResult {
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Connects to the SSE endpoint for a room and dispatches events
 * to the provided handlers. Reconnects with exponential backoff.
 */
export function useServerEvents(
  roomId: string | null,
  handlers: ServerEventHandlers,
): UseServerEventsResult {
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConnected(false);
  }, []);

  const connectSSE = useCallback(
    (room: string) => {
      if (unmountedRef.current) return;

      // Close any existing connection before opening a new one
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const url = `/api/room/${room}/events`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("connected", () => {
        attemptRef.current = 0;
        setConnected(true);
        console.log("[SSE] Connected to room", room);
      });

      es.addEventListener("content_ready", (e) => {
        try {
          const data = JSON.parse(e.data) as ContentReadyPayload;
          handlersRef.current.onContentReady?.(data);
        } catch (err) {
          console.error("[SSE] Failed to parse content_ready", err);
        }
      });

      es.addEventListener("transcript", (e) => {
        try {
          const data = JSON.parse(e.data) as TranscriptPayload;
          handlersRef.current.onTranscript?.(data);
        } catch (err) {
          console.error("[SSE] Failed to parse transcript", err);
        }
      });

      es.addEventListener("ui_control", (e) => {
        try {
          const data = JSON.parse(e.data) as UIControlPayload;
          handlersRef.current.onUIControl?.(data);
        } catch (err) {
          console.error("[SSE] Failed to parse ui_control", err);
        }
      });

      es.addEventListener("game_started", (e) => {
        try {
          handlersRef.current.onGameStarted?.(JSON.parse(e.data));
        } catch (err) {
          console.error("[SSE] Failed to parse game_started", err);
        }
      });

      es.addEventListener("game_ended", (e) => {
        try {
          handlersRef.current.onGameEnded?.(JSON.parse(e.data));
        } catch (err) {
          console.error("[SSE] Failed to parse game_ended", err);
        }
      });

      // Single error handler — schedule reconnect with backoff
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setConnected(false);

        if (unmountedRef.current) return;

        const attempt = ++attemptRef.current;
        if (attempt > MAX_RECONNECT_ATTEMPTS) {
          console.error("[SSE] Max reconnect attempts reached -- giving up");
          return;
        }

        const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1)) +
          Math.floor(Math.random() * 500);
        console.warn(`[SSE] Reconnecting in ${delay}ms (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`);

        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          connectSSE(room);
        }, delay);
      };
    },
    [],
  );

  useEffect(() => {
    unmountedRef.current = false;
    if (!roomId) return;

    attemptRef.current = 0;
    connectSSE(roomId);

    return () => {
      unmountedRef.current = true;
      cleanup();
    };
  }, [roomId, connectSSE, cleanup]);

  return { connected };
}
