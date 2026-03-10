import { useParams, useSearchParams } from "react-router-dom";
import { RoomLayout } from "@/modules/display/layout/RoomLayout";
import { Board } from "@/modules/display/components/Board";
import type { GameHostHandle } from "@/modules/display/components/GameHost";
import { ControlBar } from "@/modules/display/components/ui/ControlBar";
import { ParticipantList } from "@/modules/display/components/ui/ParticipantList";
import { ScoreBoard } from "@/modules/display/components/ui/ScoreBoard";
import { MultiplayerScoreboard } from "@/modules/display/components/ui/MultiplayerScoreboard";
import { LoadingOverlay } from "@/modules/display/components/ui/LoadingOverlay";
import { ChatInput } from "@/modules/display/components/ui/ChatInput";
import { useRoom } from "@/modules/realtime/hooks/useRoom";
import { useSync } from "@/modules/realtime/hooks/useSync";
import { useVoice } from "@/modules/realtime/hooks/useVoice";
import { useServerEvents, type ContentReadyPayload, type UIControlPayload, type GameActionPayload } from "@/modules/realtime/hooks/useServerEvents";
import { useSessionData } from "@/modules/realtime/hooks/useSessionData";
import { useRoomTranscript } from "@/modules/realtime/hooks/useRoomTranscript";
import { useRoomParticipants } from "@/modules/realtime/hooks/useRoomParticipants";
import { RoomEvent } from "livekit-client";
import { MdGroup } from "react-icons/md";
import { cn } from "@/lib/utils";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilledBundle } from "@/types/content";

const MSG_FADE_MS = 5000; // messages fade after 5s
const MSG_VISIBLE_MS = 800; // fade-out transition duration

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
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);

  // --- Content state ---
  const [gameId, setGameId] = useState<string | undefined>();
  const [gameInitData, setGameInitData] = useState<Record<string, unknown> | undefined>();
  const [isGameActive, setIsGameActive] = useState(false);

  // --- Screen effects state ---
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [emoteTrigger, setEmoteTrigger] = useState<{ emoji: string; key: number } | null>(null);
  const [confetti, setConfetti] = useState(false);

  // --- Score HUD state ---
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect"; key: number; points?: number } | null>(null);
  const [hasOwnHUD, setHasOwnHUD] = useState(false);

  // --- Game host ref (to send teacher actions to iframe) ---
  const gameHostRef = useRef<GameHostHandle>(null);
  const screenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Auto-fade timer: re-render every second to update message opacity ---
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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
    yjsWsUrl: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/yjs`,
    roomId,
    autoConnect: hasLiveKit,
  });

  const { gameState: syncedGame, updateGameState } = useSync(room.syncStore);
  const voice = useVoice(room.livekitConnection);

  // Transcript via LiveKit data channel (lower latency than SSE)
  useEffect(() => {
    const lkRoom = room.livekitConnection?.room;
    if (!lkRoom) return;

    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== "transcript") return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        addTranscript(data.source, data.text);
      } catch (err) {
        console.error("[RoomPage] Failed to parse transcript data", err);
      }
    };

    lkRoom.on(RoomEvent.DataReceived, onData);
    return () => {
      lkRoom.off(RoomEvent.DataReceived, onData);
    };
  }, [room.connectionState, addTranscript]);

  const userName = sessionData?.userName ?? "Student";

  const { participants: roomParticipants, localUserId } = useRoomParticipants(
    room.participants,
    room.localParticipant,
    sessionData?.userName ?? "You",
  );

  // Set Yjs awareness (presence)
  useEffect(() => {
    const awareness = room.yjsProvider?.awareness;
    if (!awareness || !localUserId) return;
    awareness.setLocalStateField("user", {
      id: localUserId,
      name: sessionData?.userName ?? "Student",
    });
  }, [room.yjsProvider, localUserId, sessionData?.userName]);

  // Keep awareness in sync with game phase
  useEffect(() => {
    const awareness = room.yjsProvider?.awareness;
    if (!awareness || !localUserId) return;
    awareness.setLocalStateField("game", {
      phase: syncedGame.data?.[`${localUserId}_phase`] ?? null,
      score: score,
      active: isGameActive,
    });
  }, [room.yjsProvider, localUserId, syncedGame.data, score, isGameActive]);

  // Mark loading done once LiveKit connects (or immediately if no LiveKit)
  // Auto-enable mic so the teacher can hear the user
  useEffect(() => {
    const ac = new AbortController();
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
        signal: ac.signal,
      }).catch((err) => {
        if (!ac.signal.aborted) console.error("[RoomPage] Ensure teacher error", err);
      });
    }
    return () => ac.abort();
  }, [hasLiveKit, room.connectionState]);

  // --- Content activation ---
  const activateBundle = useCallback(
    (bundle: FilledBundle) => {
      setGameId(bundle.templateId.toLowerCase());
      setGameInitData(parseInitData(bundle));
      setIsGameActive(true);
      setScore(0);
      setStreak(0);
      setFeedback(null);
      setHasOwnHUD(false);
      addTranscript("system", "Content loaded!");
      updateGameState({ active: true, type: bundle.templateId.toLowerCase(), scores: {}, data: {}, turnOrder: [] });
    },
    [addTranscript, updateGameState],
  );

  // --- Pause / Resume (used by both ControlBar and light_control) ---
  const handlePause = useCallback(() => {
    setIsPaused(true);
    voice.setMicEnabled(false);
    if (voice.isSpeakerEnabled) voice.toggleSpeaker();
  }, [voice]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    voice.setMicEnabled(true);
    if (!voice.isSpeakerEnabled) voice.toggleSpeaker();
  }, [voice]);

  // --- SSE event handlers ---
  const handleContentReady = useCallback(
    (event: ContentReadyPayload) => {
      const { contentId, bundle } = event.payload;
      console.log("[RoomPage] SSE content_ready", { contentId });
      activateBundle(bundle as FilledBundle);
    },
    [activateBundle],
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
        } else if (action === "pause") {
          handlePause();
        } else if (action === "resume") {
          handleResume();
        }
      } else if (type === "signal_feedback") {
        const ft = payload.feedbackType as string;
        if (ft === "correct" || ft === "incorrect") {
          setFeedback({ type: ft, key: Date.now(), points: payload.points as number | undefined });
        }
        if (ft === "correct") {
          setConfetti(true);
          setTimeout(() => setConfetti(false), 100);
        }
        if (payload.message) {
          addTranscript("system", payload.message as string);
        }
      }
    },
    [addTranscript, handlePause, handleResume],
  );

  // Teacher sends a game_action → forward to iframe
  const handleGameAction = useCallback(
    (data: GameActionPayload) => {
      // If targeted to a specific player, only forward if it's us
      if (data.target_player && data.target_player !== localUserId) return;
      console.log("[RoomPage] SSE game_action", data);
      gameHostRef.current?.sendAction(data.action, data.params);
    },
    [localUserId],
  );

  const sse = useServerEvents(roomId || null, {
    onContentReady: handleContentReady,
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
      if (typeof state.score === "number") setScore(state.score);
      if (state.hasOwnHUD) setHasOwnHUD(true);
      sendToTeacher(`[game_state_update from ${userName}] ${JSON.stringify(state)}`);
      // Sync score to Yjs for multiplayer scoreboard
      if (typeof state.score === "number" && localUserId) {
        updateGameState({
          scores: { ...syncedGame.scores, [localUserId]: state.score },
          data: { ...syncedGame.data, [`${localUserId}_phase`]: state.phase ?? null },
        });
      }
    },
    [sendToTeacher, userName, localUserId, updateGameState, syncedGame.scores, syncedGame.data],
  );

  const handleGameEvent = useCallback(
    (name: string, data: Record<string, unknown>) => {
      if (name === "correctAnswer") {
        setStreak((s) => s + 1);
        setFeedback({ type: "correct", key: Date.now(), points: 10 });
      } else if (name === "incorrectAnswer") {
        setStreak(0);
        setFeedback({ type: "incorrect", key: Date.now() });
      }

      // Send screenshot on game start so teacher sees the visual
      if (name === "gameStarted") {
        if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
        screenshotTimerRef.current = setTimeout(async () => {
          screenshotTimerRef.current = null;
          const dataUrl = await gameHostRef.current?.captureScreenshot();
          if (dataUrl) {
            fetch("/api/teacher/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomId, imageBase64: dataUrl }),
            }).catch((err) => console.error("[RoomPage] Screenshot send error", err));
          }
        }, 500);
      }

      sendToTeacher(`[game_event:${name} from ${userName}] ${JSON.stringify(data)}`);
    },
    [sendToTeacher, userName, roomId],
  );

  const handleGameEnd = useCallback(
    (results?: Record<string, unknown>) => {
      setIsGameActive(false);
      if (results) {
        sendToTeacher(`[game_event:gameEnd from ${userName}] ${JSON.stringify(results)}`);
      }
      updateGameState({ active: false });
    },
    [sendToTeacher, userName, updateGameState],
  );

  const handleEndGame = useCallback(() => {
    if (screenshotTimerRef.current) {
      clearTimeout(screenshotTimerRef.current);
      screenshotTimerRef.current = null;
    }
    sendToTeacher(`[game_event:gameEnd from ${userName}] ${JSON.stringify({ outcome: "closed_by_user" })}`);
    setIsGameActive(false);
    setGameId(undefined);
    setGameInitData(undefined);
    updateGameState({ active: false });
  }, [sendToTeacher, userName, updateGameState]);

  // --- Text chat: send to AI teacher ---
  const handleSendText = useCallback(
    (text: string) => {
      addTranscript("user", text, true);
      sendToTeacher(`[${userName}] ${text}`);
    },
    [addTranscript, sendToTeacher, userName],
  );

  // Peers for in-game multiplayer scoreboard
  const gamePeers = useMemo(() => {
    if (!syncedGame.active || Object.keys(syncedGame.scores).length < 2) return undefined;
    return roomParticipants
      .filter(p => p.id in syncedGame.scores)
      .map(p => ({
        id: p.id,
        name: p.name,
        score: syncedGame.scores[p.id] ?? 0,
        phase: (syncedGame.data?.[`${p.id}_phase`] as string) ?? null,
      }));
  }, [syncedGame, roomParticipants]);

  // Connection state for ControlBar
  const controlBarConnectionState = useMemo(() => {
    if (isPaused) return "paused" as const;
    if (sse.connected && (room.connectionState === "connected" || !hasLiveKit)) {
      return "connected" as const;
    }
    return "disconnected" as const;
  }, [sse.connected, room.connectionState, hasLiveKit, isPaused]);

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

  const now = Date.now();

  const statusBadges = (position: "top" | "bottom") => (
    <div className={cn(
      "flex items-center gap-2",
      position === "top" && "absolute right-4 top-4 z-50",
    )}>
      <div className="flex gap-1.5 text-[10px]">
        <span className={cn("rounded-full px-1.5 py-0.5", sse.connected ? "bg-emerald-900/40 text-emerald-400" : "bg-red-900/40 text-red-400")}>
          {sse.connected ? "SSE" : "SSE off"}
        </span>
        <span className={cn("rounded-full px-1.5 py-0.5", room.connectionState === "connected" ? "bg-emerald-900/40 text-emerald-400" : "bg-neutral-800/40 text-neutral-500")}>
          {room.connectionState === "connected" ? "LK" : "LK off"}
        </span>
        <span className={cn("rounded-full px-1.5 py-0.5", room.syncStore ? "bg-emerald-900/40 text-emerald-400" : "bg-neutral-800/40 text-neutral-500")}>
          {room.syncStore ? "Yjs" : "Yjs off"}
        </span>
      </div>
      <div className="relative">
        <button
          onClick={() => setShowParticipants((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-neutral-800/60 px-3 py-1.5 text-sm text-neutral-300 backdrop-blur transition hover:bg-neutral-700/60"
        >
          <MdGroup size={18} />
          {roomParticipants.length}
        </button>
        {showParticipants && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowParticipants(false)} />
            <div className={cn(
              "absolute right-0 z-50 w-64 rounded-xl bg-neutral-800/90 p-3 shadow-xl backdrop-blur",
              position === "top" ? "top-full mt-2" : "bottom-full mb-2",
            )}>
              <ParticipantList
                participants={roomParticipants}
                localUserId={localUserId}
              />
              {sessionData?.sessionId && (
                <button
                  onClick={() => {
                    const url = `${location.origin}/join/${sessionData.sessionId}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="mt-2 w-full rounded-md bg-neutral-700/60 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-600/60"
                >
                  Copy invite link
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <RoomLayout
      hud={isGameActive && !hasOwnHUD ? <ScoreBoard score={score} streak={streak} feedback={feedback} /> : undefined}
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
              peers={gamePeers}
              onGameStateUpdate={handleGameStateUpdate}
              onGameEvent={handleGameEvent}
              onGameEnd={handleGameEnd}
              focusPoint={focusPoint}
              emoteTrigger={emoteTrigger}
              confetti={confetti}
            />
          </div>

          {/* Chat overlay (bottom of board) — auto-fading messages */}
          {chatExpanded && <div className="absolute inset-0 z-30" onClick={() => setChatExpanded(false)} />}
          <div className="pointer-events-none absolute bottom-16 right-4 z-40">
            <div
              className={cn(
                "pointer-events-none w-80 px-4 py-3",
                chatExpanded && "pointer-events-auto max-h-[60vh] overflow-y-auto rounded-xl bg-neutral-900/70 backdrop-blur-md",
              )}
              onClick={() => !chatExpanded && setChatExpanded(true)}
            >
              {(chatExpanded ? transcript : transcript.slice(-6)).map((entry, i) => {
                const age = now - entry.timestamp;
                const faded = !chatExpanded && age > MSG_FADE_MS;
                return (
                  <div
                    key={entry.timestamp + i}
                    className={cn(
                      "pointer-events-auto mb-1.5 rounded-lg px-3 py-1.5 text-sm backdrop-blur-sm transition-opacity",
                      faded ? "pointer-events-none opacity-0" : "opacity-100",
                      entry.source === "ai"
                        ? "bg-emerald-900/30 text-emerald-100"
                        : entry.source === "user"
                          ? "ml-auto max-w-[80%] bg-neutral-800/40 text-neutral-200"
                          : "bg-neutral-900/30 text-center text-xs italic text-neutral-500",
                    )}
                    style={{ transitionDuration: `${MSG_VISIBLE_MS}ms` }}
                  >
                    {entry.source !== "system" && (
                      <span className="mr-2 text-xs font-semibold uppercase text-neutral-500">
                        {entry.source === "ai" ? "Teacher" : "You"}
                      </span>
                    )}
                    {entry.text}
                  </div>
                );
              })}
              <div ref={transcriptEndRef} />
              <div className="pointer-events-auto"><ChatInput
                onSend={handleSendText}
                disabled={!sse.connected}
              /></div>
            </div>
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
          onConnect={() => room.connect()}
          onPause={handlePause}
          onResume={handleResume}
        >
          {hasOwnHUD && statusBadges("bottom")}
        </ControlBar>
      }
      overlay={
        <>
          {!hasOwnHUD && statusBadges("top")}
          {syncedGame.active && Object.keys(syncedGame.scores).length > 1 && (
            <MultiplayerScoreboard
              scores={syncedGame.scores}
              participants={roomParticipants}
              localUserId={localUserId}
            />
          )}
        </>
      }
      loadingOverlay={<LoadingOverlay visible={loading} message={loadingMsg} />}
    />
  );
}
