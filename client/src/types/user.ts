import type { VoiceName, LanguageCode } from "../config/constants";

/** User profile persisted across sessions. */
export interface UserProfile {
  id: string;
  name: string;
  /** AI-observed learning traits, e.g. "enjoys animals", "struggles with past tense" */
  observations: string[];
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

/** User display/interaction preferences. */
export interface UserPreferences {
  voice: VoiceName;
  language: LanguageCode;
  /** Show/hide 3D avatar */
  showAvatar: boolean;
}

/** Tracks a user's learning progress. */
export interface LearningProgress {
  userId: string;
  totalPoints: number;
  highestStreak: number;
  currentStreak: number;
  /** Per-unit completion: unitId -> pages completed */
  unitProgress: Record<string, number>;
  lastActivityAt: string | null;
}

/** Ephemeral state for the current session. */
export interface SessionState {
  userId: string;
  /** Currently loaded unit */
  currentUnitId: string | null;
  /** Current page within the unit */
  currentPage: number;
  /** Active room ID, if in a collaborative session */
  roomId: string | null;
  /** Whether the AI connection is active */
  connected: boolean;
}
