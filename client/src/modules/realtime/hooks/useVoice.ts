/**
 * React hook for mic/speaker controls via LiveKit.
 * Toggle microphone and speaker, check audio status.
 */

import { useState, useEffect, useCallback } from "react";
import { RoomEvent } from "livekit-client";
import type { LivekitConnection } from "../livekit/livekit-client";
import { createLogger } from "@/lib/logger";

const log = createLogger("useVoice");

export interface UseVoiceResult {
  /** Whether the local microphone is enabled. */
  isMicEnabled: boolean;
  /** Whether the local speaker/audio output is enabled. */
  isSpeakerEnabled: boolean;
  /** Toggle microphone on/off. */
  toggleMic: () => Promise<void>;
  /** Toggle speaker/audio output on/off. */
  toggleSpeaker: () => void;
  /** Explicitly set mic state. */
  setMicEnabled: (enabled: boolean) => Promise<void>;
}

/**
 * Voice controls hook for LiveKit.
 * Pass the LiveKit connection from useRoom().
 */
export function useVoice(connection: LivekitConnection | null): UseVoiceResult {
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);

  // Sync mic state with LiveKit
  useEffect(() => {
    if (!connection) return;

    const room = connection.room;

    function syncMicState() {
      const localParticipant = room.localParticipant;
      if (localParticipant) {
        setIsMicEnabled(localParticipant.isMicrophoneEnabled);
      }
    }

    room.on(RoomEvent.TrackMuted, syncMicState);
    room.on(RoomEvent.TrackUnmuted, syncMicState);
    room.on(RoomEvent.LocalTrackPublished, syncMicState);
    room.on(RoomEvent.LocalTrackUnpublished, syncMicState);

    // Initial sync
    syncMicState();

    return () => {
      room.off(RoomEvent.TrackMuted, syncMicState);
      room.off(RoomEvent.TrackUnmuted, syncMicState);
      room.off(RoomEvent.LocalTrackPublished, syncMicState);
      room.off(RoomEvent.LocalTrackUnpublished, syncMicState);
    };
  }, [connection]);

  const toggleMic = useCallback(async () => {
    if (!connection) return;
    const lp = connection.room.localParticipant;
    if (!lp) return;

    const newState = !lp.isMicrophoneEnabled;
    await lp.setMicrophoneEnabled(newState);
    setIsMicEnabled(newState);
    log.info("Mic toggled", { enabled: newState });
  }, [connection]);

  const setMicEnabled = useCallback(
    async (enabled: boolean) => {
      if (!connection) return;
      const lp = connection.room.localParticipant;
      if (!lp) return;

      await lp.setMicrophoneEnabled(enabled);
      setIsMicEnabled(enabled);
      log.info("Mic set", { enabled });
    },
    [connection],
  );

  const toggleSpeaker = useCallback(() => {
    if (!connection) return;
    const room = connection.room;
    const newState = !isSpeakerEnabled;

    // Mute/unmute all remote audio tracks
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          if (newState) {
            pub.track.attach();
          } else {
            pub.track.detach();
          }
        }
      });
    });

    setIsSpeakerEnabled(newState);
    log.info("Speaker toggled", { enabled: newState });
  }, [connection, isSpeakerEnabled]);

  return {
    isMicEnabled,
    isSpeakerEnabled,
    toggleMic,
    toggleSpeaker,
    setMicEnabled,
  };
}
