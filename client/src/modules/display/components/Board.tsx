import React, { useCallback, useRef } from "react";
import type { FilledBundle } from "@/types/content";
import type { CursorPosition, Annotation } from "@/types/room";
import type { GameState, GameResults } from "../hooks/useGameState";
import { BundleRenderer } from "./BundleRenderer";
import { SharedCursors } from "./SharedCursors";
import { Annotations } from "./Annotations";
import { ScreenEffects } from "./ScreenEffects";

interface BoardProps {
  /** The filled bundle to render. */
  bundle: FilledBundle | null;
  /** The game ID (e.g. "flashcard", "solar-system"). */
  gameId?: string;
  /** Cursor positions from Yjs sync state. */
  cursors?: Record<string, CursorPosition>;
  /** Local user ID. */
  localUserId: string;
  /** Name map for cursor labels. */
  participantNames?: Record<string, string>;
  /** Shared annotations from Yjs. */
  annotations?: Annotation[];
  /** Whether annotation drawing is enabled. */
  annotationEnabled?: boolean;
  /** Called when a new annotation stroke is created. */
  onAnnotationAdd?: (annotation: Omit<Annotation, "id" | "createdAt">) => void;
  /** AI teacher focus highlight point. */
  focusPoint?: { x: number; y: number } | null;
  /** Emote trigger. */
  emoteTrigger?: { emoji: string; key: number } | null;
  /** Confetti mode active. */
  confetti?: boolean;
  /** Game lifecycle callbacks. */
  onGameStateUpdate?: (state: GameState) => void;
  onGameEnd?: (results?: GameResults) => void;
  /** Called when the user's cursor moves over the board. */
  onCursorMove?: (position: { x: number; y: number }) => void;
}

/**
 * Main shared display surface. Layered rendering:
 *   1. Content layer (BundleRenderer)
 *   2. Cursor layer (SharedCursors)
 *   3. Annotation layer (Annotations)
 *   4. Screen effects layer (ScreenEffects: focus highlight + emotes)
 */
export const Board: React.FC<BoardProps> = ({
  bundle,
  gameId,
  cursors = {},
  localUserId,
  participantNames = {},
  annotations = [],
  annotationEnabled = false,
  onAnnotationAdd,
  focusPoint = null,
  emoteTrigger = null,
  confetti = false,
  onGameStateUpdate,
  onGameEnd,
  onCursorMove,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);

  /** Track mouse movement and emit normalised coordinates. */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!onCursorMove || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      onCursorMove({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    },
    [onCursorMove],
  );

  return (
    <div
      ref={boardRef}
      className="relative h-full w-full overflow-hidden rounded-xl bg-neutral-900"
      onMouseMove={handleMouseMove}
    >
      {/* Layer 1: Content */}
      <div className="absolute inset-0 z-10">
        <BundleRenderer
          bundle={bundle}
          gameId={gameId}
          onGameStateUpdate={onGameStateUpdate}
          onGameEnd={onGameEnd}
        />
      </div>

      {/* Layer 2: Annotations */}
      <Annotations
        annotations={annotations}
        onAnnotationAdd={onAnnotationAdd}
        enabled={annotationEnabled}
        userId={localUserId}
      />

      {/* Layer 3: Shared Cursors */}
      <SharedCursors
        cursors={cursors}
        localUserId={localUserId}
        nameMap={participantNames}
      />

      {/* Layer 4: Screen Effects (focus highlight + emotes) */}
      <ScreenEffects focusPoint={focusPoint} emoteTrigger={emoteTrigger} confetti={confetti} />
    </div>
  );
};
