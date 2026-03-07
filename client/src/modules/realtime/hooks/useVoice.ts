/**
 * React hook for mic/speaker controls via LiveKit.
 * Toggle microphone and speaker, check audio status.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { RoomEvent, Track } from "livekit-client";
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

  const audioElementsRef = useRef<Set<HTMLMediaElement>>(new Set());

  // Auto-attach remote audio tracks + sync mic state
  useEffect(() => {
    if (!connection) return;

    const room = connection.room;

    // Attach remote audio tracks so we can hear them
    function onTrackSubscribed(track: Track) {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      audioElementsRef.current.add(el);
      log.info("Remote audio track attached", { sid: track.sid });
    }

    function onTrackUnsubscribed(track: Track) {
      if (track.kind !== Track.Kind.Audio) return;
      const elements = track.detach();
      elements.forEach((el) => {
        audioElementsRef.current.delete(el);
        el.remove();
      });
      log.info("Remote audio track detached", { sid: track.sid });
    }

    // Attach any already-subscribed remote audio tracks
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track && pub.isSubscribed) {
          onTrackSubscribed(pub.track);
        }
      });
    });

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);

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
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.TrackMuted, syncMicState);
      room.off(RoomEvent.TrackUnmuted, syncMicState);
      room.off(RoomEvent.LocalTrackPublished, syncMicState);
      room.off(RoomEvent.LocalTrackUnpublished, syncMicState);
      // Clean up audio elements
      audioElementsRef.current.forEach((el) => el.remove());
      audioElementsRef.current.clear();
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
    const newState = !isSpeakerEnabled;

    // Mute/unmute all tracked audio elements
    audioElementsRef.current.forEach((el) => {
      el.muted = !newState;
    });

    setIsSpeakerEnabled(newState);
    log.info("Speaker toggled", { enabled: newState });
  }, [isSpeakerEnabled]);

  return {
    isMicEnabled,
    isSpeakerEnabled,
    toggleMic,
    toggleSpeaker,
    setMicEnabled,
  };
}
