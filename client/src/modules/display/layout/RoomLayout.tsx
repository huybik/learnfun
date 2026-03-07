import React from "react";
import { cn } from "@/lib/utils";

interface RoomLayoutProps {
  /** The main board area (center). */
  board: React.ReactNode;
  /** Sidebar content (participant list, chat, avatar). */
  sidebar?: React.ReactNode;
  /** Bottom controls. */
  controls?: React.ReactNode;
  /** Top-left HUD (score, streak). */
  hud?: React.ReactNode;
  /** Loading overlay. */
  loadingOverlay?: React.ReactNode;
  /** Whether the sidebar is visible. */
  sidebarOpen?: boolean;
}

/**
 * Main room layout: board (center) + optional sidebar (right).
 * Responsive: sidebar collapses on mobile.
 */
export const RoomLayout: React.FC<RoomLayoutProps> = ({
  board,
  sidebar,
  controls,
  hud,
  loadingOverlay,
  sidebarOpen = true,
}) => {
  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-neutral-950">
      {/* Main board area */}
      <div className="relative flex flex-1 flex-col">
        {/* HUD (top-left, absolute) */}
        {hud}

        {/* Board */}
        <main className="relative flex-1 overflow-hidden p-2 sm:p-4">
          {board}
        </main>

        {/* Controls (bottom, absolute inside board area) */}
        {controls}
      </div>

      {/* Sidebar */}
      {sidebar && (
        <aside
          className={cn(
            "flex h-full w-80 flex-col border-l border-white/10 bg-neutral-900 transition-all duration-300",
            sidebarOpen
              ? "translate-x-0"
              : "pointer-events-none translate-x-full opacity-0",
            // On mobile, sidebar overlays as a drawer
            "fixed right-0 top-0 z-[70] lg:relative lg:z-auto",
          )}
        >
          {sidebar}
        </aside>
      )}

      {/* Loading overlay (covers everything) */}
      {loadingOverlay}
    </div>
  );
};
