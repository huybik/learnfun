/**
 * Creates a Yjs WebSocket provider.
 * Connects a Y.Doc to a y-websocket server for CRDT-based realtime sync.
 */

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { Awareness } from "y-protocols/awareness";
import { createLogger } from "@/lib/logger";

const log = createLogger("yjs-provider");

export interface YjsProviderResult {
  doc: Y.Doc;
  provider: WebsocketProvider;
  awareness: Awareness;
  destroy: () => void;
}

/**
 * Create a Yjs document and connect it to a y-websocket server.
 * Each room gets its own Y.Doc identified by roomId.
 */
export function createYjsProvider(roomId: string, wsUrl: string): YjsProviderResult {
  const doc = new Y.Doc();

  log.info("Creating Yjs provider", { roomId, wsUrl });

  const provider = new WebsocketProvider(wsUrl, roomId, doc, {
    connect: true,
    // Reconnect automatically with default y-websocket backoff
  });

  provider.on("status", (event: { status: string }) => {
    log.info("Yjs provider status", { roomId, status: event.status });
  });

  provider.on("sync", (synced: boolean) => {
    log.debug("Yjs sync state", { roomId, synced });
  });

  const awareness = provider.awareness;

  function destroy() {
    log.info("Destroying Yjs provider", { roomId });
    provider.disconnect();
    provider.destroy();
    doc.destroy();
  }

  return { doc, provider, awareness, destroy };
}
