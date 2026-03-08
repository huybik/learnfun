import React from "react";
import type { FilledBundle } from "@/types/content";
import type { GameState, GameResults } from "../hooks/useGameState";
import { ContentRenderer } from "./ContentRenderer";
import { GAME_COMPONENTS } from "../plugin-registry";

const noop = () => {};

interface BundleRendererProps {
  bundle: FilledBundle | null;
  /** The game ID (e.g. "flashcard", "solar-system"). */
  gameId?: string;
  /** Callbacks for game lifecycle. */
  onGameStateUpdate?: (state: GameState) => void;
  onGameEnd?: (results?: GameResults) => void;
}

/**
 * Dynamic renderer: looks up the game component and delegates to ContentRenderer.
 */
export const BundleRenderer: React.FC<BundleRendererProps> = ({
  bundle,
  gameId,
  onGameStateUpdate,
  onGameEnd,
}) => {
  if (!bundle || !gameId) {
    return (
      <div className="flex h-full w-full items-center justify-center text-neutral-500">
        <p>No content loaded</p>
      </div>
    );
  }

  return (
    <ContentRenderer
      bundle={bundle}
      contentKind={gameId}
      registry={GAME_COMPONENTS}
      dataSlotKey="game_data"
      onGameStateUpdate={onGameStateUpdate ?? noop}
      onGameEnd={onGameEnd ?? noop}
    />
  );
};
