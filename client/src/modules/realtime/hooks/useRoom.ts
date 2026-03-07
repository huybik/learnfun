/**
 * React hook for room lifecycle.
 * Joins a LiveKit room + Yjs document on mount, leaves on unmount.
 * Returns participants, connectionState, and localParticipant.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { Participant } from "livekit-client";
import {
  createLivekitConnection,
  type LivekitConnection,
  type ConnectionStatus,
} from "../livekit/livekit-client";
import { createYjsProvider, type YjsProviderResult } from "../sync/yjs-provider";
import { SyncStore } from "../sync/sync-store";
import { createLogger } from "@/lib/logger";

const log = createLogger("useRoom");

export interface UseRoomConfig {
  /** LiveKit server URL. */
  livekitUrl: string;
  /** LiveKit access token for this user. */
  token: string;
  /** y-websocket server URL. */
  yjsWsUrl: string;
  /** Room ID (used as Yjs document name). */
  roomId: string;
  /** Auto-connect on mount. Default: true. */
  autoConnect?: boolean;
}

export interface UseRoomResult {
  connectionState: ConnectionStatus;
  participants: Participant[];
  localParticipant: Participant | undefined;
  syncStore: SyncStore | null;
  livekitConnection: LivekitConnection | null;
  yjsProvider: YjsProviderResult | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useRoom(config: UseRoomConfig): UseRoomResult {
  const { livekitUrl, token, yjsWsUrl, roomId, autoConnect = true } = config;

  const [connectionState, setConnectionState] = useState<ConnectionStatus>("disconnected");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<Participant | undefined>();
  const [syncStore, setSyncStore] = useState<SyncStore | null>(null);

  const lkRef = useRef<LivekitConnection | null>(null);
  const yjsRef = useRef<YjsProviderResult | null>(null);
  const connectedRef = useRef(false);

  const refreshParticipants = useCallback(() => {
    if (!lkRef.current) return;
    setParticipants(lkRef.current.getParticipants());
    setLocalParticipant(lkRef.current.getLocalParticipant());
  }, []);

  const connect = useCallback(async () => {
    if (connectedRef.current) return;
    connectedRef.current = true;

    log.info("Connecting to room", { roomId });

    // Set up LiveKit
    const lk = createLivekitConnection({ url: livekitUrl, token });
    lkRef.current = lk;

    lk.onConnectionChange((state) => {
      setConnectionState(state);
      if (state === "connected") refreshParticipants();
    });
    lk.onParticipantJoined(() => refreshParticipants());
    lk.onParticipantLeft(() => refreshParticipants());

    // Set up Yjs (skip if no WebSocket URL provided)
    if (yjsWsUrl) {
      const yjs = createYjsProvider(roomId, yjsWsUrl);
      yjsRef.current = yjs;

      const store = new SyncStore(yjs.doc);
      setSyncStore(store);
    }

    // Connect LiveKit
    try {
      await lk.connect();
      refreshParticipants();
    } catch (err) {
      log.error("LiveKit connection failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      setConnectionState("disconnected");
      connectedRef.current = false;
    }
  }, [livekitUrl, token, yjsWsUrl, roomId, refreshParticipants]);

  const disconnect = useCallback(() => {
    log.info("Disconnecting from room", { roomId });

    if (lkRef.current) {
      lkRef.current.disconnect();
      lkRef.current = null;
    }
    if (yjsRef.current) {
      yjsRef.current.destroy();
      yjsRef.current = null;
    }
    setSyncStore(null);
    setParticipants([]);
    setLocalParticipant(undefined);
    setConnectionState("disconnected");
    connectedRef.current = false;
  }, [roomId]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connectionState,
    participants,
    localParticipant,
    syncStore,
    livekitConnection: lkRef.current,
    yjsProvider: yjsRef.current,
    connect,
    disconnect,
  };
}
