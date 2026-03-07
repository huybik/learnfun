import { useState, useEffect } from "react";
import type { VoiceName, LanguageCode } from "@/config/constants";

export interface SessionData {
  userName: string;
  voicePreference: VoiceName;
  languageCode: LanguageCode;
  sessionId: string;
  livekitToken?: string;
  livekitUrl?: string;
}

function getSessionData(): SessionData | null {
  try {
    const raw = localStorage.getItem("learnfun-session");
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Reads session data from localStorage on mount.
 * Returns the parsed session or null if missing/invalid.
 */
export function useSessionData(): SessionData | null {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  useEffect(() => {
    const data = getSessionData();
    setSessionData(data);
    console.log("[useSessionData] Session data from localStorage:", data);
    if (!data) {
      console.warn("[useSessionData] No session data found in localStorage");
    }
  }, []);

  return sessionData;
}
