import { useParams, useSearchParams } from "react-router-dom";
import { RoomLayout } from "@/modules/display/layout/RoomLayout";
import { Board } from "@/modules/display/components/Board";
import type { GameHostHandle } from "@/modules/display/components/GameHost";
import { ControlBar } from "@/modules/display/components/ui/ControlBar";
import { ParticipantList } from "@/modules/display/components/ui/ParticipantList";
import { LoadingOverlay } from "@/modules/display/components/ui/LoadingOverlay";
import { ChatInput } from "@/modules/display/components/ui/ChatInput";
import { useRoom } from "@/modules/realtime/hooks/useRoom";
import { useVoice } from "@/modules/realtime/hooks/useVoice";
import { useServerEvents, type ContentReadyPayload, type UIControlPayload, type GameActionPayload } from "@/modules/realtime/hooks/useServerEvents";
import { useSessionData } from "@/modules/realtime/hooks/useSessionData";
import { useRoomTranscript } from "@/modules/realtime/hooks/useRoomTranscript";
import { useRoomParticipants } from "@/modules/realtime/hooks/useRoomParticipants";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilledBundle } from "@/types/content";

// ---------------------------------------------------------------------------
// Room Page
// ---------------------------------------------------------------------------

/** Parse game init data from a filled bundle. */
function parseInitData(bundle: FilledBundle): Record<string, unknown> {
  const raw = bundle.filledSlots["game_data"];
  if (!raw) return bundle.filledSlots;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return bundle.filledSlots;
  }
}

export default function RoomPage() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Connecting...");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);

  // --- Content state ---
  const [gameId, setGameId] = useState<string | undefined>();
  const [gameInitData, setGameInitData] = useState<Record<string, unknown> | undefined>();
  const [isGameActive, setIsGameActive] = useState(false);

  // --- Screen effects state ---
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [emoteTrigger, setEmoteTrigger] = useState<{ emoji: string; key: number } | null>(null);
  const [confetti, setConfetti] = useState(false);

  // --- Game host ref (to send teacher actions to iframe) ---
  const gameHostRef = useRef<GameHostHandle>(null);

  // --- Custom hooks ---
  const sessionData = useSessionData();
  const { transcript, addTranscript, transcriptEndRef } = useRoomTranscript();

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

  const voice = useVoice(room.livekitConnection);

  const { participants: roomParticipants, localUserId } = useRoomParticipants(
    room.participants,
    room.localParticipant,
    sessionData?.userName ?? "You",
  );

  // Mark loading done once LiveKit connects (or immediately if no LiveKit)
  // Auto-enable mic so the teacher can hear the user
  useEffect(() => {
    if (!hasLiveKit) {
      setLoading(false);
      setLoadingMsg("");
    } else if (room.connectionState === "connected") {
      setLoading(false);
      setLoadingMsg("");
      addTranscript("system", "Connected! Waiting for AI teacher...");
      voice.setMicEnabled(true);

      // Ensure a teacher agent is running (handles server restart / page reload)
      fetch("/api/teacher/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          userName: sessionData?.userName ?? "Student",
          voicePreference: sessionData?.voicePreference,
          languageCode: sessionData?.languageCode,
        }),
      }).catch((err) => console.error("[RoomPage] Ensure teacher error", err));
    }
  }, [hasLiveKit, room.connectionState]);

  // --- Content activation ---
  const activateBundle = useCallback(
    (bundle: FilledBundle) => {
      setGameId(bundle.templateId.toLowerCase());
      setGameInitData(parseInitData(bundle));
      setIsGameActive(true);
      addTranscript("system", "Content loaded!");
    },
    [addTranscript],
  );

  // --- SSE event handlers ---
  const handleContentReady = useCallback(
    (event: ContentReadyPayload) => {
      const { contentId, bundle } = event.payload;
      console.log("[RoomPage] SSE content_ready", { contentId });
      activateBundle(bundle as FilledBundle);
    },
    [activateBundle],
  );

  const handleTranscript = useCallback(
    (data: { source: "user" | "ai"; text: string }) => {
      addTranscript(data.source, data.text);
    },
    [addTranscript],
  );

  const handleUIControl = useCallback(
    (data: UIControlPayload) => {
      const { type, payload } = data;

      if (type === "light_control") {
        const action = payload.action as string;
        const p = (payload.params ?? {}) as Record<string, unknown>;
        if (action === "highlight" || action === "focus") {
          setFocusPoint({ x: p.x as number, y: p.y as number });
        } else if (action === "emote") {
          setEmoteTrigger({ emoji: (p.emoji as string) ?? "✨", key: Date.now() });
        }
      } else if (type === "signal_feedback") {
        const ft = payload.feedbackType as string;
        if (ft === "correct") {
          setConfetti(true);
          setTimeout(() => setConfetti(false), 100);
        }
        if (payload.message) {
          addTranscript("system", payload.message as string);
        }
      }
    },
    [addTranscript],
  );

  // Teacher sends a game_action → forward to iframe
  const handleGameAction = useCallback(
    (data: GameActionPayload) => {
      console.log("[RoomPage] SSE game_action", data);
      gameHostRef.current?.sendAction(data.action, data.params);
    },
    [],
  );

  const sse = useServerEvents(roomId || null, {
    onContentReady: handleContentReady,
    onTranscript: handleTranscript,
    onUIControl: handleUIControl,
    onGameAction: handleGameAction,
  });

  // --- Game → Teacher: forward state updates and events ---
  const sendToTeacher = useCallback(
    (text: string) => {
      fetch("/api/teacher/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, text }),
      }).catch((err) => console.error("[RoomPage] Teacher message error", err));
    },
    [roomId],
  );

  const handleGameStateUpdate = useCallback(
    (state: Record<string, unknown>) => {
      sendToTeacher(`[game_state_update] ${JSON.stringify(state)}`);
    },
    [sendToTeacher],
  );

  const handleGameEvent = useCallback(
    (name: string, data: Record<string, unknown>) => {
      sendToTeacher(`[game_event:${name}] ${JSON.stringify(data)}`);
    },
    [sendToTeacher],
  );

  const handleGameEnd = useCallback(
    (results?: Record<string, unknown>) => {
      setIsGameActive(false);
      if (results) {
        sendToTeacher(`[game_event:gameEnd] ${JSON.stringify(results)}`);
      }
    },
    [sendToTeacher],
  );

  const handleEndGame = useCallback(() => {
    setIsGameActive(false);
    setGameId(undefined);
    setGameInitData(undefined);
  }, []);

  // --- Text chat: send to AI teacher ---
  const handleSendText = useCallback(
    (text: string) => {
      addTranscript("user", text, true);
      sendToTeacher(text);
    },
    [addTranscript, sendToTeacher],
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
              gameId={gameId}
              gameInitData={gameInitData}
              gameHostRef={gameHostRef}
              localUserId={localUserId}
              onGameStateUpdate={handleGameStateUpdate}
              onGameEvent={handleGameEvent}
              onGameEnd={handleGameEnd}
              focusPoint={focusPoint}
              emoteTrigger={emoteTrigger}
              confetti={confetti}
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
            <p>Mic: {voice.isMicEnabled ? "active" : "muted"}</p>
          </div>
        </div>
      }
      controls={
        <ControlBar
          isMuted={!voice.isMicEnabled}
          onMuteToggle={() => voice.toggleMic()}
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
