/**
 * GameHost — loads a game in an iframe and bridges postMessage
 * communication between the game and the learnfun platform.
 *
 * Replaces: BundleRenderer + ContentRenderer + plugin-registry
 */

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

// --- Public handle (exposed to parent via ref) ---

export interface GameHostHandle {
  /** Send an action to the game iframe (from teacher or platform). */
  sendAction(name: string, params: Record<string, unknown>): void;
}

interface GameHostProps {
  /** Game identifier (e.g. "flashcard", "solar-system"). */
  gameId: string;
  /** Initial data parsed from the filled bundle. */
  initData: Record<string, unknown>;
  /** Called when the game sends a state update. */
  onStateUpdate?: (state: Record<string, unknown>) => void;
  /** Called when the game emits a named event. */
  onEvent?: (name: string, data: Record<string, unknown>) => void;
  /** Called when the game signals it has ended. */
  onEnd?: (results: Record<string, unknown>) => void;
}

export const GameHost = forwardRef<GameHostHandle, GameHostProps>(
  ({ gameId, initData, onStateUpdate, onEvent, onEnd }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const initDataRef = useRef(initData);
    initDataRef.current = initData;

    // Expose sendAction to parent via ref
    useImperativeHandle(ref, () => ({
      sendAction(name: string, params: Record<string, unknown>) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "action", name, params },
          window.location.origin,
        );
      },
    }));

    // Listen for messages from the game iframe
    const onMessage = useCallback(
      (e: MessageEvent) => {
        // Only handle messages from our iframe
        if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;

        const msg = e.data;
        if (!msg?.type) return;

        switch (msg.type) {
          case "ready":
            // Game loaded — send init data
            iframeRef.current?.contentWindow?.postMessage(
              { type: "init", data: initDataRef.current },
              window.location.origin,
            );
            break;
          case "state":
            onStateUpdate?.(msg.state);
            break;
          case "event":
            onEvent?.(msg.name, msg.data);
            break;
          case "end":
            onEnd?.(msg.results);
            break;
        }
      },
      [onStateUpdate, onEvent, onEnd],
    );

    useEffect(() => {
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [onMessage]);

    return (
      <iframe
        ref={iframeRef}
        src={`/games/${gameId}/`}
        className="h-full w-full border-0"
        allow="autoplay"
        title={gameId}
      />
    );
  },
);

GameHost.displayName = "GameHost";
