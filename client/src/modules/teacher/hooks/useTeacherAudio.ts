/**
 * Simplified teacher audio hook.
 * In the ported architecture, the Teacher agent runs server-side.
 * Students connect to LiveKit and speak into it; the server-side
 * Teacher agent hears them via LiveKit.
 *
 * This hook just provides mic mute/unmute state for the UI.
 */

import { useState, useCallback } from "react";

export interface UseTeacherAudioResult {
  /** Whether the mic is muted (local UI state). */
  isMuted: boolean;
  /** Toggle mute. */
  toggleMute: () => void;
}

/**
 * Simple audio state for the room page UI.
 * Actual mic control happens through the LiveKit useVoice hook.
 */
export function useTeacherAudio(): UseTeacherAudioResult {
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  return { isMuted, toggleMute };
}
