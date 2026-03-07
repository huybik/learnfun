/**
 * Module 5: Interactive Main Display & Renderer
 *
 * Public API — re-exports all display components, hooks, and layout.
 * Games and lessons are loaded lazily via the plugin registry.
 */

// ---- Components ----
export { Board } from "./components/Board";
export { BundleRenderer } from "./components/BundleRenderer";
export { LessonRenderer } from "./components/LessonRenderer";
export { GamePodRenderer } from "./components/GamePodRenderer";
export { InteractiveLessonRenderer } from "./components/InteractiveLessonRenderer";
export { SharedCursors } from "./components/SharedCursors";
export { Annotations } from "./components/Annotations";
export { FocusHighlight } from "./components/FocusHighlight";
export { EmoteOverlay } from "./components/EmoteOverlay";

// ---- UI Components ----
export { ControlBar } from "./components/ui/ControlBar";
export { ParticipantList } from "./components/ui/ParticipantList";
export { ScoreBoard } from "./components/ui/ScoreBoard";
export { LoadingOverlay } from "./components/ui/LoadingOverlay";

// ---- Plugin Registry ----
export {
  GAME_COMPONENTS,
  LESSON_COMPONENTS,
  hasGameComponent,
  hasLessonComponent,
} from "./plugin-registry";

// ---- Hooks ----
export { useBundleLoader } from "./hooks/useBundleLoader";
export {
  useGameState,
  useGameContext,
  GameContext,
  type GameContextValue,
  type GamePhase,
  type GameResults,
  type GameState,
  type GameStateManager,
} from "./hooks/useGameState";

// ---- Layout ----
export { RoomLayout } from "./layout/RoomLayout";
