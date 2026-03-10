/**
 * Typed wrapper around Yjs shared types.
 * Provides a clean API for reading/writing the shared room state.
 */

import * as Y from "yjs";
import type { Annotation, CursorPosition, SyncState } from "@/types/room";
import { createLogger } from "@/lib/logger";

const log = createLogger("sync-store");

export interface BoardSyncState {
  currentBundle: string | null;
  focusPoint: { x: number; y: number } | null;
  currentPage: number;
}

export interface PendingAction {
  from: string;
  name: string;
  params: Record<string, unknown>;
  ts: number;
}

export interface GameSyncState {
  active: boolean;
  type: string | null;
  leader: string | null;
  fullState: Record<string, unknown> | null;
  scores: Record<string, number>;
  pendingAction: PendingAction | null;
  turnOrder: string[];
  data: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

type ObserverCallback = (event: Y.YEvent<Y.AbstractType<unknown>>[], txn: Y.Transaction) => void;
type ObservableTarget = {
  observeDeep: (callback: ObserverCallback) => void;
  unobserveDeep: (callback: ObserverCallback) => void;
};

export class SyncStore {
  private doc: Y.Doc;
  private boardMap: Y.Map<unknown>;
  private gameMap: Y.Map<unknown>;
  private cursorsMap: Y.Map<unknown>;
  private annotationsArray: Y.Array<unknown>;
  private chatArray: Y.Array<unknown>;
  private observers: Array<() => void> = [];

  constructor(doc: Y.Doc) {
    this.doc = doc;
    this.boardMap = doc.getMap("board");
    this.gameMap = doc.getMap("game");
    this.cursorsMap = doc.getMap("cursors");
    this.annotationsArray = doc.getArray("annotations");
    this.chatArray = doc.getArray("chat");
    log.debug("SyncStore initialized");
  }

  // -- Board --

  getBoardState(): BoardSyncState {
    return {
      currentBundle: (this.boardMap.get("currentBundle") as string) ?? null,
      focusPoint: (this.boardMap.get("focusPoint") as { x: number; y: number }) ?? null,
      currentPage: (this.boardMap.get("currentPage") as number) ?? 0,
    };
  }

  setBoardContent(bundleId: string): void {
    this.doc.transact(() => {
      this.boardMap.set("currentBundle", bundleId);
    });
  }

  setFocusPoint(point: { x: number; y: number } | null): void {
    this.doc.transact(() => {
      this.boardMap.set("focusPoint", point);
    });
  }

  setCurrentPage(page: number): void {
    this.doc.transact(() => {
      this.boardMap.set("currentPage", page);
    });
  }

  // -- Game --

  getGameState(): GameSyncState {
    return {
      active: (this.gameMap.get("active") as boolean) ?? false,
      type: (this.gameMap.get("type") as string) ?? null,
      leader: (this.gameMap.get("leader") as string) ?? null,
      fullState: (this.gameMap.get("fullState") as Record<string, unknown>) ?? null,
      scores: this.collectScores(),
      pendingAction: (this.gameMap.get("pendingAction") as PendingAction) ?? null,
      turnOrder: (this.gameMap.get("turnOrder") as string[]) ?? [],
      data: (this.gameMap.get("data") as Record<string, unknown>) ?? {},
    };
  }

  updateGameState(partial: Partial<GameSyncState>): void {
    this.doc.transact(() => {
      for (const [key, value] of Object.entries(partial)) {
        // scores are stored as individual score_<userId> keys — skip the aggregated field
        if (key === "scores") continue;
        this.gameMap.set(key, value);
      }
    });
  }

  setPlayerScore(userId: string, score: number): void {
    this.doc.transact(() => {
      this.gameMap.set(`score_${userId}`, score);
    });
  }

  setPlayerPhase(userId: string, phase: string | null): void {
    this.doc.transact(() => {
      this.gameMap.set(`phase_${userId}`, phase);
    });
  }

  setPendingAction(action: PendingAction | null): void {
    this.doc.transact(() => {
      this.gameMap.set("pendingAction", action);
    });
  }

  clearPendingAction(): void {
    this.doc.transact(() => {
      this.gameMap.set("pendingAction", null);
    });
  }

  private collectScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    this.gameMap.forEach((value, key) => {
      if (key.startsWith("score_") && typeof value === "number") {
        scores[key.slice(6)] = value;
      }
    });
    return scores;
  }

  // -- Cursors --

  getCursors(): Record<string, CursorPosition> {
    const result: Record<string, CursorPosition> = {};
    this.cursorsMap.forEach((value, key) => {
      result[key] = value as CursorPosition;
    });
    return result;
  }

  setCursor(userId: string, position: CursorPosition): void {
    this.cursorsMap.set(userId, position);
  }

  removeCursor(userId: string): void {
    this.cursorsMap.delete(userId);
  }

  // -- Annotations --

  getAnnotations(): Annotation[] {
    return this.annotationsArray.toArray() as Annotation[];
  }

  addAnnotation(annotation: Annotation): void {
    this.annotationsArray.push([annotation]);
  }

  // -- Chat --

  getChat(): ChatMessage[] {
    return this.chatArray.toArray() as ChatMessage[];
  }

  addChatMessage(message: ChatMessage): void {
    this.chatArray.push([message]);
  }

  // -- Observation --

  observe(path: string, callback: ObserverCallback): () => void {
    const target = this.getTarget(path);
    if (!target) {
      log.warn("observe: unknown path", { path });
      return () => {};
    }

    target.observeDeep(callback);
    const unsubscribe = () => target.unobserveDeep(callback);
    this.observers.push(unsubscribe);
    return unsubscribe;
  }

  getSnapshot(): SyncState {
    return {
      currentPage: this.getBoardState().currentPage,
      gameState: this.getGameState().active ? (this.getGameState().data as Record<string, unknown>) : null,
      cursors: this.getCursors(),
      annotations: this.getAnnotations(),
    };
  }

  destroy(): void {
    this.observers.forEach((unsub) => unsub());
    this.observers = [];
  }

  private getTarget(path: string): ObservableTarget | null {
    switch (path) {
      case "board":
        return this.boardMap as unknown as ObservableTarget;
      case "game":
        return this.gameMap as unknown as ObservableTarget;
      case "cursors":
        return this.cursorsMap as unknown as ObservableTarget;
      case "annotations":
        return this.annotationsArray as unknown as ObservableTarget;
      case "chat":
        return this.chatArray as unknown as ObservableTarget;
      default:
        return null;
    }
  }
}
