import React, { useRef, useState, useCallback, useEffect } from "react";
import type { Annotation } from "@/types/room";

interface AnnotationsProps {
  /** Existing annotations to render (from Yjs). */
  annotations: Annotation[];
  /** Called when the user finishes a new stroke. */
  onAnnotationAdd?: (annotation: Omit<Annotation, "id" | "createdAt">) => void;
  /** Whether drawing mode is active. */
  enabled: boolean;
  /** Current user ID. */
  userId: string;
  /** Pen colour. */
  color?: string;
  /** Pen width in px. */
  strokeWidth?: number;
}

/**
 * SVG-based drawing/annotation canvas overlay.
 * Renders existing annotations and captures new strokes when enabled.
 */
export const Annotations: React.FC<AnnotationsProps> = ({
  annotations,
  onAnnotationAdd,
  enabled,
  userId,
  color = "#ef4444",
  strokeWidth = 3,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>("");
  const pointsRef = useRef<Array<{ x: number; y: number }>>([]);

  /** Convert a mouse/touch event to normalised 0-1 coords relative to SVG. */
  const getRelativePos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!enabled) return;
      const pos = getRelativePos(e);
      if (!pos) return;
      setIsDrawing(true);
      pointsRef.current = [pos];
      setCurrentPath(`M ${pos.x} ${pos.y}`);
    },
    [enabled, getRelativePos],
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !enabled) return;
      const pos = getRelativePos(e);
      if (!pos) return;
      pointsRef.current.push(pos);
      setCurrentPath((prev) => `${prev} L ${pos.x} ${pos.y}`);
    },
    [isDrawing, enabled, getRelativePos],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (pointsRef.current.length > 1 && onAnnotationAdd) {
      onAnnotationAdd({
        userId,
        type: "stroke",
        data: currentPath,
        color,
      });
    }

    setCurrentPath("");
    pointsRef.current = [];
  }, [isDrawing, onAnnotationAdd, userId, currentPath, color]);

  // Cancel drawing if disabled mid-stroke
  useEffect(() => {
    if (!enabled && isDrawing) {
      setIsDrawing(false);
      setCurrentPath("");
      pointsRef.current = [];
    }
  }, [enabled, isDrawing]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className={`absolute inset-0 z-20 h-full w-full ${enabled ? "cursor-crosshair" : "pointer-events-none"}`}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* Existing annotations */}
      {annotations.map((ann) => {
        if (ann.type === "stroke") {
          return (
            <path
              key={ann.id}
              d={ann.data}
              fill="none"
              stroke={ann.color}
              strokeWidth={strokeWidth / 1000}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        if (ann.type === "text") {
          // Text annotations store "x,y|text" in data
          const [coords, text] = ann.data.split("|");
          const [x, y] = (coords ?? "0.5,0.5").split(",").map(Number);
          return (
            <text
              key={ann.id}
              x={x}
              y={y}
              fill={ann.color}
              fontSize={0.02}
              fontWeight="bold"
            >
              {text}
            </text>
          );
        }
        return null;
      })}

      {/* Current stroke in progress */}
      {currentPath && (
        <path
          d={currentPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth / 1000}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={0.7}
        />
      )}
    </svg>
  );
};
