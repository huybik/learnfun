import React, { Suspense, useMemo } from "react";
import type { FilledBundle } from "@/types/content";
import { GameContext, type GameContextValue, type GameResults, type GameState } from "../hooks/useGameState";
import { LESSON_COMPONENTS } from "../plugin-registry";

interface InteractiveLessonRendererProps {
  bundle: FilledBundle;
  /** The lesson kind, e.g. "solar-system". */
  lessonKind: string;
  /** Called when lesson state updates (to sync with AI / Yjs). */
  onGameStateUpdate: (state: GameState) => void;
  /** Called when the lesson ends. */
  onGameEnd: (results?: GameResults) => void;
}

/**
 * Renders an interactive lesson bundle.
 * Uses GameContext so the lesson can communicate with the AI teacher
 * in the same way games do.
 */
export const InteractiveLessonRenderer: React.FC<InteractiveLessonRendererProps> = ({
  bundle,
  lessonKind,
  onGameStateUpdate,
  onGameEnd,
}) => {
  const LessonComponent = LESSON_COMPONENTS[lessonKind];

  const initialData = useMemo(() => {
    const raw = bundle.filledSlots["lesson_data"];
    if (!raw) return bundle.filledSlots;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return bundle.filledSlots;
    }
  }, [bundle.filledSlots]);

  const contextValue: GameContextValue = useMemo(
    () => ({
      gameType: lessonKind,
      initialData,
      updateGameStateForAI: onGameStateUpdate,
      endGame: onGameEnd,
    }),
    [lessonKind, initialData, onGameStateUpdate, onGameEnd]
  );

  if (!LessonComponent) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-white">
        <p className="text-xl font-semibold">Unknown Lesson Type</p>
        <p className="text-neutral-400">
          Lesson kind &quot;{lessonKind}&quot; is not registered.
        </p>
        <button
          onClick={() => onGameEnd({ outcome: "quit", reason: "unknown_lesson" })}
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
            Loading lesson...
          </div>
        }
      >
        <LessonComponent />
      </Suspense>
    </GameContext.Provider>
  );
};
