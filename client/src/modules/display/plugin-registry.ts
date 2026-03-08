/**
 * Plugin registry: maps game IDs to lazy-loaded React components.
 *
 * Each game lives in data/games/<id>/ with a skill.md and src/.
 * This registry bridges game IDs to their React components.
 */

import { lazy, type ComponentType } from "react";

const WordMatchGame = lazy(() =>
  import("@data/games/wordmatch/src").then((m) => ({ default: m.WordMatchGame }))
);
// flashcard has been migrated to iframe-based game (served via GameHost)
const SentenceBuilderGame = lazy(() =>
  import("@data/games/sentencebuilder/src").then((m) => ({ default: m.SentenceBuilderGame }))
);
const SpaceShooterGame = lazy(() =>
  import("@data/games/spaceshooter/src").then((m) => ({ default: m.SpaceShooterGame }))
);
const SolarSystemGame = lazy(() =>
  import("@data/games/solar-system/src").then((m) => ({ default: m.SolarSystemLesson }))
);

/** All registered game components, keyed by game ID. */
export const GAME_COMPONENTS: Record<string, ComponentType> = {
  wordmatch: WordMatchGame,
  sentencebuilder: SentenceBuilderGame,
  spaceshooter: SpaceShooterGame,
  "solar-system": SolarSystemGame,
};

/** Check if a game ID has a registered component. */
export function hasGameComponent(id: string): boolean {
  return id in GAME_COMPONENTS;
}
