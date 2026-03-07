import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

// ---- Types ----

/** Outcome when a game ends. */
export interface GameResults {
  outcome: "completed" | "quit" | "failed";
  finalScore?: number;
  reason?: string;
}

/** Arbitrary game state sent to AI / synced to other participants. */
export type GameState = Record<string, unknown>;

// ---- Context (for game components to consume) ----

export interface GameContextValue {
  gameType: string;
  initialData: Record<string, unknown>;
  updateGameStateForAI: (state: GameState) => void;
  endGame: (results?: GameResults) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used inside a GameContext provider");
  return ctx;
}

// ---- Hook ----

interface UseGameStateOptions {
  /** Called when game state is updated — use to sync via Yjs / send to AI. */
  onStateUpdate?: (gameType: string, state: GameState) => void;
  /** Called when game ends — use to send results to AI, update scores. */
  onGameEnd?: (gameType: string, results: GameResults) => void;
}

/** What the useGameState hook returns. */
export interface GameStateReturn {
  /** Whether a game is currently running. */
  isRunning: boolean;
  /** Current game type, e.g. "WordMatch". Null when no game active. */
  gameType: string | null;
  /** Send a partial game state update (to AI and other participants). */
  updateState: (partial: GameState) => void;
  /** Start a new game with the given type and data. */
  setRunning: (type: string, data: Record<string, unknown>) => void;
  /** End the current game. */
  endGame: (results?: GameResults) => void;
}

/**
 * Manages the full game lifecycle: start -> playing -> ended.
 */
export function useGameState(opts: UseGameStateOptions = {}): GameStateReturn {
  const [gameType, setGameType] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const setRunning = useCallback((type: string, _data: Record<string, unknown>) => {
    setGameType(type);
    setIsRunning(true);
  }, []);

  const updateState = useCallback(
    (partial: GameState) => {
      if (gameType) {
        opts.onStateUpdate?.(gameType, partial);
      }
    },
    [gameType, opts],
  );

  const endGame = useCallback(
    (results: GameResults = { outcome: "quit" }) => {
      if (gameType) {
        opts.onGameEnd?.(gameType, results);
      }
      setGameType(null);
      setIsRunning(false);
    },
    [gameType, opts],
  );

  return useMemo(
    () => ({ isRunning, gameType, updateState, setRunning, endGame }),
    [isRunning, gameType, updateState, setRunning, endGame],
  );
}
