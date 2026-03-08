/**
 * Module 5: Interactive Main Display & Renderer
 *
 * Public API — re-exports all display components, hooks, and layout.
 * Games are loaded lazily via the plugin registry.
 */

// ---- Components ----
export { Board } from "./components/Board";
export { BundleRenderer } from "./components/BundleRenderer";
export { ContentRenderer } from "./components/ContentRenderer";
export { SharedCursors } from "./components/SharedCursors";
export { Annotations } from "./components/Annotations";
export { ScreenEffects } from "./components/ScreenEffects";

// ---- UI Components ----
export { ControlBar } from "./components/ui/ControlBar";
export { ParticipantList } from "./components/ui/ParticipantList";
export { ScoreBoard } from "./components/ui/ScoreBoard";
export { LoadingOverlay } from "./components/ui/LoadingOverlay";

// ---- Plugin Registry ----
export {
  GAME_COMPONENTS,
  hasGameComponent,
} from "./plugin-registry";

// ---- Hooks ----
export { useBundleLoader } from "./hooks/useBundleLoader";
export {
  useGameState,
  useGameContext,
  GameContext,
  type GameContextValue,
  type GameResults,
  type GameState,
  type GameStateReturn,
} from "./hooks/useGameState";

// ---- Layout ----
export { RoomLayout } from "./layout/RoomLayout";
