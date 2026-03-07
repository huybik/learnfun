/**
 * React hook for reading/writing Yjs shared state.
 * Reactive: re-renders when Yjs data changes.
 */

import { useState, useEffect, useCallback } from "react";
import type { SyncStore, BoardSyncState, GameSyncState } from "../sync/sync-store";

export interface UseSyncResult {
  boardState: BoardSyncState;
  gameState: GameSyncState;
  setBoardContent: (bundleId: string) => void;
  setCurrentPage: (page: number) => void;
  setFocusPoint: (point: { x: number; y: number } | null) => void;
  updateGameState: (partial: Partial<GameSyncState>) => void;
}

const defaultBoard: BoardSyncState = { currentBundle: null, focusPoint: null, currentPage: 0 };
const defaultGame: GameSyncState = {
  active: false,
  type: null,
  data: {},
  scores: {},
  turnOrder: [],
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

  return {
    boardState,
    gameState,
    setBoardContent,
    setCurrentPage,
    setFocusPoint,
    updateGameState,
  };
}
