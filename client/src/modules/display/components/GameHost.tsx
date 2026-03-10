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
  /** Capture a screenshot of the game iframe (same-origin only). */
  captureScreenshot(): Promise<string | null>;
}

interface GameHostProps {
  /** Game identifier (e.g. "flashcard", "solar-system"). */
  gameId: string;
  /** Initial data parsed from the filled bundle. */
  initData: Record<string, unknown>;
  /** Peer players for multiplayer (sent as _peers action). */
  peers?: { id: string; name: string; score: number; phase: string | null }[];
  /** If true, skip sending init data — follower waits for _sync from leader. */
  isFollower?: boolean;
  /** Called when the game sends a state update. */
  onStateUpdate?: (state: Record<string, unknown>) => void;
  /** Called when the game emits a named event. */
  onEvent?: (name: string, data: Record<string, unknown>) => void;
  /** Called when the game signals it has ended. */
  onEnd?: (results: Record<string, unknown>) => void;
}

export const GameHost = forwardRef<GameHostHandle, GameHostProps>(
  ({ gameId, initData, peers, isFollower, onStateUpdate, onEvent, onEnd }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const initDataRef = useRef(initData);
    initDataRef.current = initData;
    const prevPeersRef = useRef('');

    // Expose sendAction + captureScreenshot to parent via ref
    useImperativeHandle(ref, () => ({
      sendAction(name: string, params: Record<string, unknown>) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "action", name, params },
          window.location.origin,
        );
      },
      async captureScreenshot(): Promise<string | null> {
        const doc = iframeRef.current?.contentDocument;
        if (!doc?.body) return null;
        try {
          const { default: html2canvas } = await import("html2canvas");
          const canvas = await html2canvas(doc.body, { scale: 0.5, logging: false });
          return canvas.toDataURL("image/jpeg", 0.6);
        } catch (e) {
          console.error("[GameHost] Screenshot capture failed", e);
          return null;
        }
      },
    }));

    // Listen for messages from the game iframe
    const onMessage = useCallback(
      (e: MessageEvent) => {
        // Only handle messages from our iframe at same origin
        if (e.origin !== window.location.origin) return;
        if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;

        const msg = e.data;
        if (!msg?.type) return;

        switch (msg.type) {
          case "ready":
            // Game loaded — send init data (leader only; follower waits for _sync)
            if (!isFollower) {
              iframeRef.current?.contentWindow?.postMessage(
                { type: "init", data: initDataRef.current },
                window.location.origin,
              );
            }
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

    // Send peers to iframe when they change (JSON dedup)
    useEffect(() => {
      if (!peers) return;
      const json = JSON.stringify(peers);
      if (json === prevPeersRef.current) return;
      prevPeersRef.current = json;
      iframeRef.current?.contentWindow?.postMessage(
        { type: "action", name: "_peers", params: { players: peers } },
        window.location.origin,
      );
    }, [peers]);

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
