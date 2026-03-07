/** A fillable slot in a template (e.g. a text field, image region, audio clip). */
export interface TemplateSlot {
  id: string;
  kind: "text" | "image" | "audio" | "video";
  label: string;
  required: boolean;
  /** Optional default value or placeholder */
  defaultValue?: string;
}

/** Describes a lesson or game template shell stored locally. */
export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  type: "lesson" | "game";
  version: number;
  slots: TemplateSlot[];
  /** Path to the template bundle relative to the template directory */
  bundlePath: string;
  thumbnailUrl?: string;
  /** Tags for AI discovery and search. */
  tags?: string[];
  /** Instructions for the AI on how to fill the slots. */
  aiInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

/** A template with all slots filled, ready to render. */
export interface FilledBundle {
  templateId: string;
  sessionId: string;
  filledSlots: Record<string, string>;
  /** Path to the filled bundle in local storage */
  bundlePath: string;
  createdAt: string;
}

/** Lesson-specific template with ordered pages. */
export interface LessonTemplate extends TemplateManifest {
  type: "lesson";
  /** Interactive lesson kind, e.g. "solar-system". */
  lessonKind?: string;
  pages: number;
  /** Unit ID this lesson belongs to */
  unitId: string;
}

/** Game pod template with game-specific config. */
export interface GamePodTemplate extends TemplateManifest {
  type: "game";
  gameKind: "wordmatch" | "flashcard" | "sentencebuilder" | "spaceshooter" | "freeform";
  /** Min/max players for multiplayer pods */
  minPlayers: number;
  maxPlayers: number;
}
