// Layout
export const MOBILE_BREAKPOINT = 768;

// Content data directories
export const GAMES_DIR = "data/games";
export const LESSONS_DIR = "data/lessons";
export const BUNDLES_DIR = "data/bundles";

// LiveKit room sync channel
export const ROOM_SYNC_CHANNEL = "eduforge-sync";

// Default voices (carried over from existing app)
export const DEFAULT_VOICES = [
  { value: "Aoede", label: "Aoede (Female)" },
  { value: "Charon", label: "Charon (Male)" },
  { value: "Fenrir", label: "Fenrir (Male)" },
  { value: "Kore", label: "Kore (Female)" },
  { value: "Leda", label: "Leda (Female)" },
  { value: "Orus", label: "Orus (Male)" },
  { value: "Puck", label: "Puck (Male)" },
  { value: "Zephyr", label: "Zephyr (Female)" },
] as const;

export type VoiceName = (typeof DEFAULT_VOICES)[number]["value"];

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "vi-VN", label: "Vietnamese" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "de-DE", label: "German" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "it-IT", label: "Italian" },
  { value: "ru-RU", label: "Russian" },
  { value: "zh-CN", label: "Chinese (Mandarin, Simplified)" },
  { value: "zh-TW", label: "Chinese (Mandarin, Traditional)" },
  { value: "hi-IN", label: "Hindi (India)" },
  { value: "ar-SA", label: "Arabic (Saudi Arabia)" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["value"];
