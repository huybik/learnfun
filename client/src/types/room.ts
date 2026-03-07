/** A collaborative room (backed by LiveKit + Yjs). */
export interface Room {
  id: string;
  name: string;
  hostId: string;
  participants: Participant[];
  createdAt: string;
  /** Active template/lesson being viewed */
  activeContentId: string | null;
}

/** A user in a room. */
export interface Participant {
  id: string;
  name: string;
  role: "host" | "student" | "observer";
  joinedAt: string;
  /** LiveKit participant identity */
  livekitIdentity: string;
}

/** Shape of Yjs-backed shared state for a room. */
export interface SyncState {
  /** Current page/slide index */
  currentPage: number;
  /** Active game state, if any */
  gameState: Record<string, unknown> | null;
  /** Per-user cursor positions */
  cursors: Record<string, CursorPosition>;
  /** Shared annotations on the canvas */
  annotations: Annotation[];
}

/** A user's cursor position on the shared canvas. */
export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  /** Timestamp for staleness detection */
  updatedAt: number;
}

/** A drawing annotation on the shared canvas. */
export interface Annotation {
  id: string;
  userId: string;
  type: "stroke" | "highlight" | "text";
  /** SVG path data for strokes, text content for text, etc. */
  data: string;
  color: string;
  createdAt: number;
}
