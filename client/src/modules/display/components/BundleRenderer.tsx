import React from "react";
import type { FilledBundle } from "@/types/content";
import type { GameState, GameResults } from "../hooks/useGameState";
import { LessonRenderer } from "./LessonRenderer";
import { ContentRenderer } from "./ContentRenderer";
import { GAME_COMPONENTS, LESSON_COMPONENTS } from "../plugin-registry";

const noop = () => {};

interface BundleRendererProps {
  bundle: FilledBundle | null;
  /** "lesson" | "game" — determined from the template manifest. */
  contentType: "lesson" | "game" | null;
  /** For game pods: the specific game kind. */
  gameKind?: string;
  /** For interactive lessons: the lesson kind (e.g. "solar-system"). */
  lessonKind?: string;
  /** Current page for lesson bundles. */
  currentPage?: number;
  /** Callbacks for game lifecycle. */
  onGameStateUpdate?: (state: GameState) => void;
  onGameEnd?: (results?: GameResults) => void;
}

/**
 * Dynamic renderer: inspects content type and delegates to
 * LessonRenderer or ContentRenderer.
 */
export const BundleRenderer: React.FC<BundleRendererProps> = ({
  bundle,
  contentType,
  gameKind,
  lessonKind,
  currentPage = 0,
  onGameStateUpdate,
  onGameEnd,
}) => {
  if (!bundle || !contentType) {
    return (
      <div className="flex h-full w-full items-center justify-center text-neutral-500">
        <p>No content loaded</p>
      </div>
    );
  }

  // Interactive lessons (e.g. solar-system) — rendered like games with GameContext
  if (contentType === "lesson" && lessonKind) {
    return (
      <ContentRenderer
        bundle={bundle}
        contentKind={lessonKind}
        registry={LESSON_COMPONENTS}
        dataSlotKey="lesson_data"
        label="Lesson"
        onGameStateUpdate={onGameStateUpdate ?? noop}
        onGameEnd={onGameEnd ?? noop}
      />
    );
  }

  if (contentType === "lesson") {
    return <LessonRenderer bundle={bundle} currentPage={currentPage} />;
  }

  if (contentType === "game" && gameKind) {
    return (
      <ContentRenderer
        bundle={bundle}
        contentKind={gameKind}
        registry={GAME_COMPONENTS}
        dataSlotKey="game_data"
        label="Game"
        onGameStateUpdate={onGameStateUpdate ?? noop}
        onGameEnd={onGameEnd ?? noop}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center text-neutral-500">
      <p>Unknown content type: {contentType}</p>
    </div>
  );
};
