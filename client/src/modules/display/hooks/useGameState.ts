import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

// ---- Types ----

/** Game lifecycle phase. */
export type GamePhase = "idle" | "starting" | "playing" | "ended" | "error";

/** Outcome when a game ends. */
export interface GameResults {
  outcome: "completed" | "quit" | "failed";
  finalScore?: number;
  reason?: string;
}

/** Arbitrary game state sent to AI / synced to other participants. */
export type GameState = Record<string, unknown>;

/** What the useGameState hook returns. */
export interface GameStateManager {
  /** Current game type, e.g. "WordMatch". Null when no game active. */
  gameType: string | null;
  /** Raw data used to initialise the game. */
  initialData: Record<string, unknown> | null;
  /** Current lifecycle phase. */
  phase: GamePhase;
  /** Start a new game with the given type and data. */
  startGame: (type: string, data: Record<string, unknown>) => void;
  /** Send a partial game state update (to AI and other participants). */
  updateGameState: (partial: GameState) => void;
  /** End the current game. */
  endGame: (results?: GameResults) => void;
  /** Latest game state snapshot. */
  latestState: GameState | null;
  /** Results from the last completed game. */
  lastResults: GameResults | null;
}

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

/**
 * Manages the full game lifecycle: start -> playing -> ended.
 */
export function useGameState(opts: UseGameStateOptions = {}): GameStateManager {
  const [gameType, setGameType] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [latestState, setLatestState] = useState<GameState | null>(null);
  const [lastResults, setLastResults] = useState<GameResults | null>(null);

  const startGame = useCallback((type: string, data: Record<string, unknown>) => {
    setGameType(type);
    setInitialData(data);
    setPhase("playing");
    setLatestState(null);
    setLastResults(null);
  }, []);

  const updateGameState = useCallback(
    (partial: GameState) => {
      setLatestState(partial);
      if (gameType) {
        opts.onStateUpdate?.(gameType, partial);
      }
    },
    [gameType, opts],
  );

  const endGame = useCallback(
    (results: GameResults = { outcome: "quit" }) => {
      setLastResults(results);
      setPhase("ended");
      if (gameType) {
        opts.onGameEnd?.(gameType, results);
      }
      // Reset after a tick so consumers can read lastResults
      setTimeout(() => {
        setGameType(null);
        setInitialData(null);
        setPhase("idle");
      }, 0);
    },
    [gameType, opts],
  );

  return useMemo(
    () => ({
      gameType,
      initialData,
      phase,
      startGame,
      updateGameState,
      endGame,
      latestState,
      lastResults,
    }),
    [gameType, initialData, phase, startGame, updateGameState, endGame, latestState, lastResults],
  );
}
