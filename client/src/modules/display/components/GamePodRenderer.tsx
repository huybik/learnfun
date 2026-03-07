import React, { Suspense, useMemo } from "react";
import type { FilledBundle } from "@/types/content";
import { GameContext, type GameContextValue, type GameResults, type GameState } from "../hooks/useGameState";
import { GAME_COMPONENTS } from "../plugin-registry";

interface GamePodRendererProps {
  bundle: FilledBundle;
  /** The game kind from the template, e.g. "wordmatch". */
  gameKind: string;
  /** Called when game state updates (to sync with AI / Yjs). */
  onGameStateUpdate: (state: GameState) => void;
  /** Called when the game ends. */
  onGameEnd: (results?: GameResults) => void;
}

/**
 * Renders a game pod bundle.
 * Selects the appropriate game component from the plugin registry,
 * wraps it in GameContext, and handles lifecycle.
 */
export const GamePodRenderer: React.FC<GamePodRendererProps> = ({
  bundle,
  gameKind,
  onGameStateUpdate,
  onGameEnd,
}) => {
  const GameComponent = GAME_COMPONENTS[gameKind];

  // Parse initial game data from the filled bundle slots
  const initialData = useMemo(() => {
    const raw = bundle.filledSlots["game_data"];
    if (!raw) return bundle.filledSlots;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return bundle.filledSlots;
    }
  }, [bundle.filledSlots]);

  const contextValue: GameContextValue = useMemo(
    () => ({
      gameType: gameKind,
      initialData,
      updateGameStateForAI: onGameStateUpdate,
      endGame: onGameEnd,
    }),
    [gameKind, initialData, onGameStateUpdate, onGameEnd],
  );

  if (!GameComponent) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-white">
        <p className="text-xl font-semibold">Unknown Game Type</p>
        <p className="text-neutral-400">
          Game kind &quot;{gameKind}&quot; is not registered.
        </p>
        <button
          onClick={() => onGameEnd({ outcome: "quit", reason: "unknown_game" })}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-700"
        >
          Exit
        </button>
      </div>
    );
  }

  return (
    <GameContext.Provider value={contextValue}>
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            Loading game...
          </div>
        }
      >
        <GameComponent />
      </Suspense>
    </GameContext.Provider>
  );
};
