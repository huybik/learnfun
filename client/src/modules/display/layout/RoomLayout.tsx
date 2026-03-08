import React from "react";

interface RoomLayoutProps {
  /** The main board area (full-screen). */
  board: React.ReactNode;
  /** Bottom controls. */
  controls?: React.ReactNode;
  /** Top-left HUD (score, streak). */
  hud?: React.ReactNode;
  /** Overlay elements (participant badge, etc). */
  overlay?: React.ReactNode;
  /** Loading overlay. */
  loadingOverlay?: React.ReactNode;
}

/**
 * Full-screen room layout. Game gets 100% of screen real estate.
 * All UI (chat, participants, controls) floats as transparent overlays.
 */
export const RoomLayout: React.FC<RoomLayoutProps> = ({
  board,
  controls,
  hud,
  overlay,
  loadingOverlay,
}) => {
  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-neutral-950">
      {/* Full-screen board */}
      <div className="relative flex flex-1 flex-col">
        {hud}
        <main className="relative flex-1 overflow-hidden">
          {board}
        </main>
        {controls}
      </div>

      {/* Floating overlays (participant badge, etc) */}
      {overlay}

      {/* Loading overlay (covers everything) */}
      {loadingOverlay}
    </div>
  );
};
