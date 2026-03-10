/**
 * React hook for reading/writing Yjs shared state.
 * Reactive: re-renders when Yjs data changes.
 */

import { useState, useEffect, useCallback } from "react";
import type { SyncStore, BoardSyncState, GameSyncState, PendingAction } from "../sync/sync-store";

export interface UseSyncResult {
  boardState: BoardSyncState;
  gameState: GameSyncState;
  setBoardContent: (bundleId: string) => void;
  setCurrentPage: (page: number) => void;
  setFocusPoint: (point: { x: number; y: number } | null) => void;
  updateGameState: (partial: Partial<GameSyncState>) => void;
  setPlayerScore: (userId: string, score: number) => void;
  setPlayerPhase: (userId: string, phase: string | null) => void;
  enqueuePendingAction: (action: PendingAction) => void;
  removePendingAction: (actionId: string) => void;
  clearPendingActions: () => void;
  clearPlayerState: () => void;
}

const defaultBoard: BoardSyncState = { currentBundle: null, focusPoint: null, currentPage: 0 };
const defaultGame: GameSyncState = {
  active: false,
  type: null,
  leader: null,
  initData: null,
  fullState: null,
  scores: {},
  pendingActions: [],
  turnOrder: [],
  data: {},
};

/**
 * Read/write Yjs shared state through the SyncStore.
 * Pass the syncStore from useRoom().
 */
export function useSync(syncStore: SyncStore | null): UseSyncResult {
  const [boardState, setBoardState] = useState<BoardSyncState>(defaultBoard);
  const [gameState, setGameState] = useState<GameSyncState>(defaultGame);

  // Observe board changes
  useEffect(() => {
    if (!syncStore) return;
    setBoardState(syncStore.getBoardState());

    const unsub = syncStore.observe("board", () => {
      setBoardState(syncStore.getBoardState());
    });
    return unsub;
  }, [syncStore]);

  // Observe game changes
  useEffect(() => {
    if (!syncStore) return;
    setGameState(syncStore.getGameState());

    const unsub = syncStore.observe("game", () => {
      setGameState(syncStore.getGameState());
    });
    return unsub;
  }, [syncStore]);

  const setBoardContent = useCallback(
    (bundleId: string) => {
      syncStore?.setBoardContent(bundleId);
    },
    [syncStore],
  );

  const setCurrentPage = useCallback(
    (page: number) => {
      syncStore?.setCurrentPage(page);
    },
    [syncStore],
  );

  const setFocusPoint = useCallback(
    (point: { x: number; y: number } | null) => {
      syncStore?.setFocusPoint(point);
    },
    [syncStore],
  );

  const updateGameState = useCallback(
    (partial: Partial<GameSyncState>) => {
      syncStore?.updateGameState(partial);
    },
    [syncStore],
  );

  const setPlayerScore = useCallback(
    (userId: string, score: number) => {
      syncStore?.setPlayerScore(userId, score);
    },
    [syncStore],
  );

  const setPlayerPhase = useCallback(
    (userId: string, phase: string | null) => {
      syncStore?.setPlayerPhase(userId, phase);
    },
    [syncStore],
  );

  const enqueuePendingAction = useCallback(
    (action: PendingAction) => {
      syncStore?.enqueuePendingAction(action);
    },
    [syncStore],
  );

  const removePendingAction = useCallback(
    (actionId: string) => {
      syncStore?.removePendingAction(actionId);
    },
    [syncStore],
  );

  const clearPendingActions = useCallback(() => {
    syncStore?.clearPendingActions();
  }, [syncStore]);

  const clearPlayerState = useCallback(() => {
    syncStore?.clearPlayerState();
  }, [syncStore]);

  return {
    boardState,
    gameState,
    setBoardContent,
    setCurrentPage,
    setFocusPoint,
    updateGameState,
    setPlayerScore,
    setPlayerPhase,
    enqueuePendingAction,
    removePendingAction,
    clearPendingActions,
    clearPlayerState,
  };
}
