import React from "react";
import type { CursorPosition } from "@/types/room";

/** How many ms before we consider a cursor stale and hide it. */
const STALE_THRESHOLD_MS = 5_000;

/** Distinct colors for up to 8 participants. */
const CURSOR_COLORS = [
  "#f87171", // red
  "#60a5fa", // blue
  "#34d399", // green
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#f472b6", // pink
  "#38bdf8", // sky
  "#fb923c", // orange
];

interface SharedCursorsProps {
  /** Map of userId -> cursor position. Typically from Yjs SyncState.cursors. */
  cursors: Record<string, CursorPosition>;
  /** ID of the local user (so we skip rendering our own cursor). */
  localUserId: string;
  /** Optional name map: userId -> display name. */
  nameMap?: Record<string, string>;
}

/**
 * Renders other participants' cursor positions as coloured dots with name labels.
 * Coordinates are normalised 0-1 (relative to the board surface).
 */
export const SharedCursors: React.FC<SharedCursorsProps> = ({
  cursors,
  localUserId,
  nameMap = {},
}) => {
  const now = Date.now();
  const entries = Object.entries(cursors).filter(
    ([, c]) => c.userId !== localUserId && now - c.updatedAt < STALE_THRESHOLD_MS,
  );

  if (entries.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {entries.map(([userId, cursor], i) => {
        const color = CURSOR_COLORS[i % CURSOR_COLORS.length];
        const name = nameMap[userId] ?? userId.slice(0, 6);
        return (
          <div
            key={userId}
            className="absolute transition-all duration-100 ease-out"
            style={{
              left: `${cursor.x * 100}%`,
              top: `${cursor.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Cursor dot */}
            <div
              className="h-3 w-3 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: color }}
            />
            {/* Name label */}
            <span
              className="ml-3 -mt-1 whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
};
