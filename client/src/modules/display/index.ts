/**
 * Module 5: Interactive Main Display & Renderer
 *
 * Public API — re-exports all display components, hooks, and layout.
 * Games are loaded in iframes via GameHost.
 */

// ---- Components ----
export { Board } from "./components/Board";
export { GameHost, type GameHostHandle } from "./components/GameHost";
export { SharedCursors } from "./components/SharedCursors";
export { Annotations } from "./components/Annotations";
export { ScreenEffects } from "./components/ScreenEffects";

// ---- UI Components ----
export { ControlBar } from "./components/ui/ControlBar";
export { ParticipantList } from "./components/ui/ParticipantList";
export { ScoreBoard } from "./components/ui/ScoreBoard";
export { LoadingOverlay } from "./components/ui/LoadingOverlay";

// ---- Layout ----
export { RoomLayout } from "./layout/RoomLayout";
