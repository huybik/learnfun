import { useParams, useSearchParams } from "react-router-dom";
import { RoomLayout } from "@/modules/display/layout/RoomLayout";
import { Board } from "@/modules/display/components/Board";
import { ControlBar } from "@/modules/display/components/ui/ControlBar";
import { ParticipantList } from "@/modules/display/components/ui/ParticipantList";
import { LoadingOverlay } from "@/modules/display/components/ui/LoadingOverlay";
import { ChatInput } from "@/modules/display/components/ui/ChatInput";
import { useRoom } from "@/modules/realtime/hooks/useRoom";
import { useServerEvents, type ContentReadyPayload } from "@/modules/realtime/hooks/useServerEvents";
import { useTeacherAudio } from "@/modules/teacher/hooks/useTeacherAudio";
import type { Participant as LkParticipant } from "livekit-client";
import type { Participant } from "@/types/room";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilledBundle } from "@/types/content";
import type { GameState, GameResults } from "@/modules/display/hooks/useGameState";
import { hasGameComponent } from "@/modules/display/plugin-registry";
import type { VoiceName, LanguageCode } from "@/config/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SessionData {
  userName: string;
  voicePreference: VoiceName;
  languageCode: LanguageCode;
  sessionId: string;
  livekitToken?: string;
  livekitUrl?: string;
}

function getSessionData(): SessionData | null {
  try {
    const raw = localStorage.getItem("eduforge-session");
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

interface TranscriptEntry {
  source: "user" | "ai" | "system";
  text: string;
  timestamp: number;
}

/** Map LiveKit participants to our app Participant type. */
function toLkParticipants(lkParticipants: LkParticipant[], hostIdentity?: string): Participant[] {
  return lkParticipants.map((p) => ({
    id: p.identity,
    name: p.name || p.identity,
    role: p.identity === hostIdentity ? "host" as const : "student" as const,
    joinedAt: new Date().toISOString(),
    livekitIdentity: p.identity,
  }));
}

// ---------------------------------------------------------------------------
// Room Page (simplified — no direct Gemini, no useTeacher/useTeacherTools)
// ---------------------------------------------------------------------------

export default function RoomPage() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Connecting...");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);

  // --- Content state ---
  const [activeBundle, setActiveBundle] = useState<FilledBundle | null>(null);
  const [contentType, setContentType] = useState<"lesson" | "game" | null>(null);
  const [gameKind, setGameKind] = useState<string | undefined>();
  const [lessonKind, setLessonKind] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const aiTurnSealedRef = useRef(true);
  const userTurnSealedRef = useRef(true);

  // Simple audio state (mic mute toggle for UI)
  const audio = useTeacherAudio();

  // Read session data from localStorage on mount
  useEffect(() => {
    const data = getSessionData();
    setSessionData(data);
    console.log("[RoomPage] Session data from localStorage:", data);
    if (!data) {
      console.warn("[RoomPage] No session data found in localStorage");
    }
  }, []);

  // --- LiveKit room connection ---
  const livekitUrl = sessionData?.livekitUrl || "";
  const livekitToken = sessionData?.livekitToken || "";
  const hasLiveKit = !!(livekitUrl && livekitToken);

  const room = useRoom({
    livekitUrl,
    token: livekitToken,
    yjsWsUrl: "", // Yjs not wired yet
    roomId,
    autoConnect: hasLiveKit,
  });

  // Mark loading done once LiveKit connects (or immediately if no LiveKit)
  useEffect(() => {
    if (!hasLiveKit) {
      setLoading(false);
      setLoadingMsg("");
    } else if (room.connectionState === "connected") {
      setLoading(false);
      setLoadingMsg("");
      addTranscript("system", "Connected! Waiting for AI teacher...");
    }
  }, [hasLiveKit, room.connectionState]);

  // --- Transcript helpers ---
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
    []
  );

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // --- SSE event handlers ---
  const handleContentReady = useCallback(
    async (event: ContentReadyPayload) => {
      const { contentId, bundlePath } = event.payload;
      console.log("[RoomPage] SSE content_ready", { contentId, bundlePath });

      try {
        const res = await fetch(`/api/bundles/${contentId}`);
        if (!res.ok) throw new Error(`Bundle fetch failed (${res.status})`);
        const bundle = (await res.json()) as FilledBundle;

        setActiveBundle(bundle);

        const tplId = bundle.templateId.toLowerCase();
        if (hasGameComponent(tplId)) {
          setContentType("game");
          setGameKind(tplId);
          setIsGameActive(true);
        } else {
          setContentType("lesson");
          setLessonKind(tplId);
        }
        setCurrentPage(0);
        addTranscript("system", "Content loaded!");
      } catch (err) {
        console.error("[RoomPage] Failed to load bundle from SSE event", err);
      }
    },
    [addTranscript],
  );

  const handleTranscript = useCallback(
    (data: { source: "user" | "ai"; text: string }) => {
      addTranscript(data.source, data.text);
    },
    [addTranscript],
  );

  const sse = useServerEvents(roomId || null, {
    onContentReady: handleContentReady,
    onTranscript: handleTranscript,
  });

  // --- Game & navigation handlers ---
  const handleGameStateUpdate = useCallback((state: GameState) => {
    console.log("[RoomPage] Game state update", state);
  }, []);

  const handleGameEnd = useCallback((results?: GameResults) => {
    console.log("[RoomPage] Game ended", results);
    setIsGameActive(false);
  }, []);

  const handleEndGame = useCallback(() => {
    setIsGameActive(false);
    setActiveBundle(null);
    setContentType(null);
    setGameKind(undefined);
  }, []);

  // --- Text chat: POST to /api/ta or just add to transcript ---
  const handleSendText = useCallback(
    (text: string) => {
      addTranscript("user", text);
      // Send text to server — the Teacher agent will hear it
      fetch("/api/ta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: `chat-${Date.now()}`,
          intent: text,
          context: {},
          roomId,
          userProfiles: [],
        }),
      }).catch((err) => console.error("[RoomPage] TA API error", err));
    },
    [roomId, addTranscript],
  );

  // Connection state for ControlBar
  const controlBarConnectionState = useMemo(() => {
    if (sse.connected && (room.connectionState === "connected" || !hasLiveKit)) {
      return "connected" as const;
    }
    return "disconnected" as const;
  }, [sse.connected, room.connectionState, hasLiveKit]);

  // --- Error / no-token screens ---
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">
          Missing session token. Please join from the home page.
        </p>
      </div>
    );
  }

  // Build participant list: prefer LiveKit data, fall back to local-only
  const roomParticipants: Participant[] = room.participants.length > 0
    ? toLkParticipants(room.participants, room.localParticipant?.identity)
    : [{
      id: "local-user",
      name: sessionData?.userName ?? "You",
      role: "host",
      joinedAt: new Date().toISOString(),
      livekitIdentity: "local-user",
    }];
  const localUserId = room.localParticipant?.identity ?? "local-user";

  return (
    <RoomLayout
      board={
        <div className="relative flex h-full flex-col">
          {/* Error banner */}
          {error && (
            <div className="absolute left-0 right-0 top-0 z-50 mx-auto max-w-lg rounded-md bg-red-900/50 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Main content board */}
          <div className="flex-1 overflow-hidden">
            <Board
              bundle={activeBundle}
              contentType={contentType}
              gameKind={gameKind}
              currentPage={currentPage}
              localUserId="local-user"
              onGameStateUpdate={handleGameStateUpdate}
              onGameEnd={handleGameEnd}
            />
          </div>

          {/* Transcript overlay (bottom of board) */}
          <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-40 flex justify-center">
            <div className="pointer-events-auto max-h-48 w-full max-w-2xl overflow-y-auto rounded-t-xl px-4 py-3">
              {transcript.length === 0 && !loading && (
                <p className="text-center text-sm text-neutral-500">
                  Waiting for AI teacher to speak...
                </p>
              )}
              {transcript.slice(-8).map((entry, i) => (
                <div
                  key={i}
                  className={`mb-1.5 rounded-lg px-3 py-1.5 text-sm backdrop-blur-sm ${entry.source === "ai"
                    ? "bg-emerald-900/30 text-emerald-100"
                    : entry.source === "user"
                      ? "bg-neutral-800/40 text-neutral-200 ml-auto max-w-[80%]"
                      : "bg-neutral-900/30 text-neutral-500 text-center text-xs italic"
                    }`}
                >
                  {entry.source !== "system" && (
                    <span className="mr-2 text-xs font-semibold uppercase text-neutral-500">
                      {entry.source === "ai" ? "Teacher" : "You"}
                    </span>
                  )}
                  {entry.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
              <ChatInput
                onSend={handleSendText}
                disabled={!sse.connected}
              />
            </div>
          </div>
        </div>
      }
      sidebar={
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300">
              Room {roomId.slice(0, 8)}
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-neutral-500 hover:text-white lg:hidden"
            >
              &times;
            </button>
          </div>
          <ParticipantList
            participants={roomParticipants}
            localUserId={localUserId}
          />
          {/* Debug info */}
          <div className="space-y-1 border-t border-white/10 pt-3 text-xs text-neutral-500">
            <p>LiveKit: {room.connectionState}</p>
            <p>SSE: {sse.connected ? "connected" : "disconnected"}</p>
            <p>Mic: {audio.isMuted ? "muted" : "active"}</p>
          </div>
        </div>
      }
      controls={
        <ControlBar
          isMuted={audio.isMuted}
          onMuteToggle={audio.toggleMute}
          isCameraOn={isCameraOn}
          onCameraToggle={() => setIsCameraOn(!isCameraOn)}
          isGameActive={isGameActive}
          onEndGame={handleEndGame}
          connectionState={controlBarConnectionState}
        />
      }
      loadingOverlay={<LoadingOverlay visible={loading} message={loadingMsg} />}
      sidebarOpen={sidebarOpen}
    />
  );
}
