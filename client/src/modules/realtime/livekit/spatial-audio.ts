/**
 * Spatial audio positioning helpers for LiveKit.
 * Maps 2D canvas positions to 3D spatial audio coordinates.
 */

export interface Position2D {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
}

export interface SpatialPosition {
  x: number;
  y: number;
  z: number;
}

/** Maximum distance (in spatial units) across the canvas. */
const CANVAS_SPAN = 4;

/**
 * Convert a normalized 2D position (0..1) to a 3D spatial audio position.
 * Assumes a flat plane at z=0 with the listener at center.
 */
export function toSpatialPosition(pos: Position2D): SpatialPosition {
  return {
    x: (pos.x - 0.5) * CANVAS_SPAN,
    y: (pos.y - 0.5) * CANVAS_SPAN,
    z: 0,
  };
}

/**
 * Calculate the distance between two spatial positions.
 */
export function spatialDistance(a: SpatialPosition, b: SpatialPosition): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate a volume multiplier based on distance from the listener.
 * Returns 1.0 at distance 0, fading to 0.0 at maxDistance.
 */
export function distanceAttenuation(distance: number, maxDistance: number = CANVAS_SPAN): number {
  if (distance >= maxDistance) return 0;
  if (distance <= 0) return 1;
  // Inverse-distance rolloff, clamped
  return Math.max(0, 1 - distance / maxDistance);
}
