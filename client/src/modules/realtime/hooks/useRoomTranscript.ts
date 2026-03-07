import { useState, useCallback, useEffect, useRef } from "react";

export interface TranscriptEntry {
  source: "user" | "ai" | "system";
  text: string;
  timestamp: number;
}

export interface UseRoomTranscriptResult {
  transcript: TranscriptEntry[];
  addTranscript: (source: TranscriptEntry["source"], text: string) => void;
  transcriptEndRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Manages the room transcript with turn-sealing logic.
 * Consecutive messages from the same source are merged until the
 * other source starts speaking (sealing the previous turn).
 */
export function useRoomTranscript(): UseRoomTranscriptResult {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const aiTurnSealedRef = useRef(true);
  const userTurnSealedRef = useRef(true);

  const addTranscript = useCallback(
    (source: TranscriptEntry["source"], text: string) => {
      if (!text.trim()) return;

      // Seal the other source when this source starts speaking
      if (source === "ai") userTurnSealedRef.current = true;
      if (source === "user") aiTurnSealedRef.current = true;

      const sealedRef =
        source === "ai" ? aiTurnSealedRef : source === "user" ? userTurnSealedRef : null;
      const isSealed = sealedRef?.current ?? true;
      if (sealedRef && isSealed) sealedRef.current = false;

      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        // Merge with the last entry if same source and turn not sealed
        if (last && last.source === source && source !== "system" && !isSealed) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: last.text + " " + text.trim(),
            timestamp: Date.now(),
          };
          return updated;
        }
        return [...prev, { source, text: text.trim(), timestamp: Date.now() }];
      });
    },
    [],
  );

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return { transcript, addTranscript, transcriptEndRef };
}
