import React, { useCallback, useMemo, useRef } from "react";
import type { CursorPosition, Annotation } from "@/types/room";
import { GameHost, type GameHostHandle } from "./GameHost";
import { SharedCursors } from "./SharedCursors";
import { Annotations } from "./Annotations";
import { ScreenEffects } from "./ScreenEffects";

interface BoardProps {
  /** The game ID (e.g. "flashcard", "solar-system"). */
  gameId?: string;
  /** Parsed initial data for the game (from filled bundle). */
  gameInitData?: Record<string, unknown>;
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
  onGameStateUpdate?: (state: Record<string, unknown>) => void;
  onGameEvent?: (name: string, data: Record<string, unknown>) => void;
  onGameEnd?: (results: Record<string, unknown>) => void;
  /** Called when the user's cursor moves over the board. */
  onCursorMove?: (position: { x: number; y: number }) => void;
  /** Peer players for multiplayer scoreboard inside game. */
  peers?: { id: string; name: string; score: number; phase: string | null }[];
  /** If true, this player is a follower (skip game init, wait for _sync). */
  isFollower?: boolean;
  /** Ref to control the game iframe (e.g. send teacher actions). */
  gameHostRef?: React.Ref<GameHostHandle>;
}

/**
 * Main shared display surface. Layered rendering:
 *   1. Content layer (GameHost iframe)
 *   2. Cursor layer (SharedCursors)
 *   3. Annotation layer (Annotations)
 *   4. Screen effects layer (ScreenEffects: focus highlight + emotes)
 */
export const Board: React.FC<BoardProps> = ({
  gameId,
  gameInitData,
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
  onGameEvent,
  onGameEnd,
  onCursorMove,
  peers,
  isFollower,
  gameHostRef,
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
      className="relative h-full w-full overflow-hidden bg-neutral-900"
      onMouseMove={handleMouseMove}
    >
      {/* Layer 1: Content */}
      <div className="absolute inset-0 z-10">
        {gameId && gameInitData ? (
          <GameHost
            ref={gameHostRef}
            gameId={gameId}
            initData={gameInitData}
            peers={peers}
            isFollower={isFollower}
            onStateUpdate={onGameStateUpdate}
            onEvent={onGameEvent}
            onEnd={onGameEnd}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-500">
            <p>No content loaded</p>
          </div>
        )}
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
