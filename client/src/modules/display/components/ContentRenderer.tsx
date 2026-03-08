import React, { Suspense, useMemo } from "react";
import type { ComponentType } from "react";
import type { FilledBundle } from "@/types/content";
import { GameContext, type GameContextValue, type GameResults, type GameState } from "../hooks/useGameState";

interface ContentRendererProps {
  bundle: FilledBundle;
  /** The game ID key, e.g. "wordmatch" or "solar-system". */
  contentKind: string;
  /** Component registry to look up the kind in. */
  registry: Record<string, ComponentType>;
  /** The slot key to extract initial data from. */
  dataSlotKey: string;
  /** Called when state updates (to sync with AI / Yjs). */
  onGameStateUpdate: (state: GameState) => void;
  /** Called when the game ends. */
  onGameEnd: (results?: GameResults) => void;
}

/**
 * Unified renderer for all games.
 * Selects the appropriate component from the registry,
 * wraps it in GameContext, and handles lifecycle.
 */
export const ContentRenderer: React.FC<ContentRendererProps> = ({
  bundle,
  contentKind,
  registry,
  dataSlotKey,
  onGameStateUpdate,
  onGameEnd,
}) => {
  const Component = registry[contentKind];

  // Parse initial data from the filled bundle slots
  const initialData = useMemo(() => {
    const raw = bundle.filledSlots[dataSlotKey];
    if (!raw) return bundle.filledSlots;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return bundle.filledSlots;
    }
  }, [bundle.filledSlots, dataSlotKey]);

  const contextValue: GameContextValue = useMemo(
    () => ({
      gameType: contentKind,
      initialData,
      updateGameStateForAI: onGameStateUpdate,
      endGame: onGameEnd,
    }),
    [contentKind, initialData, onGameStateUpdate, onGameEnd],
  );

  if (!Component) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-white">
        <p className="text-xl font-semibold">Unknown Game</p>
        <p className="text-neutral-400">
          Game &quot;{contentKind}&quot; is not registered.
        </p>
        <button
          onClick={() => onGameEnd({ outcome: "quit", reason: `unknown_game` })}
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
        <Component />
      </Suspense>
    </GameContext.Provider>
  );
};
