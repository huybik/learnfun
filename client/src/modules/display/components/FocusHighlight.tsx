import React, { useEffect, useState } from "react";

interface FocusHighlightProps {
  /** Focus point coordinates, normalised 0-1. Null = no focus. */
  point: { x: number; y: number } | null;
  /** Duration in ms before the highlight auto-fades. */
  duration?: number;
}

/**
 * AI Teacher's focus highlight: a pulsing ring at (x,y) on the board surface.
 * Coordinates are normalised 0-1 (relative to the board).
 */
export const FocusHighlight: React.FC<FocusHighlightProps> = ({
  point,
  duration = 4000,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!point) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [point, duration]);

  if (!point || !visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      <div
        className="absolute"
        style={{
          left: `${point.x * 100}%`,
          top: `${point.y * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Outer pulse ring */}
        <div className="absolute -inset-4 animate-ping rounded-full border-2 border-yellow-400 opacity-60" />
        {/* Middle ring */}
        <div className="absolute -inset-2 animate-pulse rounded-full border-2 border-yellow-300 opacity-80" />
        {/* Center dot */}
        <div className="h-4 w-4 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" />
      </div>
    </div>
  );
};
