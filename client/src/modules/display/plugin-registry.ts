/**
 * Plugin registry: maps gameKind / lessonKind strings to React components.
 *
 * Games and lessons live in data/ as standalone plugins.
 * Each plugin has a manifest.json (for AI discovery) and src/ (for rendering).
 * This registry bridges manifest kinds to lazy-loaded React components.
 */

import { lazy, type ComponentType } from "react";

// Lazy-load game components from data/
const WordMatchGame = lazy(() =>
  import("../../../data/games/wordmatch/src").then((m) => ({ default: m.WordMatchGame }))
);
const FlashcardGame = lazy(() =>
  import("../../../data/games/flashcard/src").then((m) => ({ default: m.FlashcardGame }))
);
const SentenceBuilderGame = lazy(() =>
  import("../../../data/games/sentencebuilder/src").then((m) => ({ default: m.SentenceBuilderGame }))
);
const SpaceShooterGame = lazy(() =>
  import("../../../data/games/spaceshooter/src").then((m) => ({ default: m.SpaceShooterGame }))
);

// Lazy-load lesson components from data/
const SolarSystemLesson = lazy(() =>
  import("../../../data/lessons/solar-system/src").then((m) => ({ default: m.SolarSystemLesson }))
);

/** All registered game components, keyed by gameKind. */
export const GAME_COMPONENTS: Record<string, ComponentType> = {
  wordmatch: WordMatchGame,
  flashcard: FlashcardGame,
  sentencebuilder: SentenceBuilderGame,
  spaceshooter: SpaceShooterGame,
};

/** All registered interactive lesson components, keyed by lessonKind. */
export const LESSON_COMPONENTS: Record<string, ComponentType> = {
  "solar-system": SolarSystemLesson,
};

/** Check if a game kind has a registered component. */
export function hasGameComponent(kind: string): boolean {
  return kind in GAME_COMPONENTS;
}

/** Check if a lesson kind has a registered component. */
export function hasLessonComponent(kind: string): boolean {
  return kind in LESSON_COMPONENTS;
}
