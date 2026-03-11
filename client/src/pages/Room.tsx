import { useParams, useSearchParams } from "react-router-dom";
import { RoomLayout } from "@/modules/display/layout/RoomLayout";
import { Board } from "@/modules/display/components/Board";
import { ControlBar } from "@/modules/display/components/ui/ControlBar";
import { ParticipantList } from "@/modules/display/components/ui/ParticipantList";
import { ScoreBoard } from "@/modules/display/components/ui/ScoreBoard";
import { MultiplayerScoreboard } from "@/modules/display/components/ui/MultiplayerScoreboard";
import { LoadingOverlay } from "@/modules/display/components/ui/LoadingOverlay";
import { ChatInput } from "@/modules/display/components/ui/ChatInput";
import { useRoom } from "@/modules/realtime/hooks/useRoom";
import { useVoice } from "@/modules/realtime/hooks/useVoice";
import { useServerEvents, type UIControlPayload } from "@/modules/realtime/hooks/useServerEvents";
import { useSessionData } from "@/modules/realtime/hooks/useSessionData";
import { useRoomTranscript } from "@/modules/realtime/hooks/useRoomTranscript";
import { useRoomParticipants } from "@/modules/realtime/hooks/useRoomParticipants";
import { useGameSession } from "@/hooks/useGameSession";
import { RoomEvent } from "livekit-client";
import { MdGroup } from "react-icons/md";
import { cn } from "@/lib/utils";

import { useCallback, useEffect, useMemo, useState } from "react";

const MSG_FADE_MS = 5000; // messages fade after 5s
const MSG_VISIBLE_MS = 800; // fade-out transition duration

// ---------------------------------------------------------------------------
// Room Page
// ---------------------------------------------------------------------------

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

  // --- Screen effects state ---
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [emoteTrigger, setEmoteTrigger] = useState<{ emoji: string; key: number } | null>(null);
  const [confetti, setConfetti] = useState(false);

  // --- Auto-fade timer: re-render every second to update message opacity ---
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // --- Session & host resolution ---
  const sessionData = useSessionData();
  const [resolvedHostId, setResolvedHostId] = useState<string | null>(sessionData?.hostId ?? null);
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

  useEffect(() => {
    setResolvedHostId(sessionData?.hostId ?? null);
  }, [sessionData?.hostId]);

  useEffect(() => {
    if (resolvedHostId || !roomId) return;
    const ac = new AbortController();
    fetch(`/api/room/${roomId}/meta`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load room meta (${res.status})`);
        return res.json() as Promise<{ hostId?: string }>;
      })
      .then((data) => {
        if (!data.hostId) return;
        setResolvedHostId(data.hostId);
        try {
          const raw = localStorage.getItem("learnfun-session");
          if (!raw) return;
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (parsed.hostId === data.hostId) return;
          parsed.hostId = data.hostId;
          localStorage.setItem("learnfun-session", JSON.stringify(parsed));
        } catch {
          // Ignore local session cache update failures.
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) {
          console.error("[RoomPage] Failed to resolve room host", err);
        }
      });
    return () => ac.abort();
  }, [resolvedHostId, roomId]);

  const userName = sessionData?.userName ?? "Student";
  const roomHostId = resolvedHostId ?? null;

  const { participants: roomParticipants, localUserId } = useRoomParticipants(
    room.participants,
    room.localParticipant,
    sessionData?.userName ?? "You",
  );

  // --- Game session (lifecycle, sync, scores, teacher comms) ---
  const game = useGameSession({
    syncStore: room.syncStore,
    roomId,
    localUserId,
    roomHostId,
    roomParticipants,
    addTranscript,
  });

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
      phase: game.localPhase,
      score: game.score,
      active: game.isGameActive,
    });
  }, [room.yjsProvider, localUserId, game.localPhase, game.score, game.isGameActive]);

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

  // --- Pause / Resume ---
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

  // --- SSE: UI control (screen effects, pause/resume, teacher feedback) ---
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
          game.triggerFeedback(ft, payload.points as number | undefined);
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
    [addTranscript, handlePause, handleResume, game.triggerFeedback],
  );

  const sse = useServerEvents(roomId || null, {
    onContentReady: game.handleContentReady,
    onUIControl: handleUIControl,
    onGameAction: game.handleGameAction,
  });

  // --- Text chat: send to AI teacher ---
  const handleSendText = useCallback(
    (text: string) => {
      addTranscript("user", text, true);
      game.sendToTeacher(`[${userName}] ${text}`);
    },
    [addTranscript, game.sendToTeacher, userName],
  );

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
      hud={game.isGameActive && !game.hasOwnHUD ? <ScoreBoard score={game.score} streak={game.streak} feedback={game.feedback} /> : undefined}
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
              gameId={game.gameId}
              gameInitData={game.gameInitData}
              gameHostRef={game.gameHostRef}
              localUserId={localUserId}
              peers={game.gamePeers}
              isFollower={game.isFollower}
              onGameStateUpdate={game.handleGameStateUpdate}
              onGameEvent={game.handleGameEvent}
              onGameEnd={game.handleGameEnd}
              onGameReady={game.handleGameReady}
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
          isGameActive={game.isGameActive}
          onEndGame={game.endGame}
          connectionState={controlBarConnectionState}
          onConnect={() => room.connect()}
          onPause={handlePause}
          onResume={handleResume}
        >
          {game.hasOwnHUD && statusBadges("bottom")}
        </ControlBar>
      }
      overlay={
        <>
          {!game.hasOwnHUD && statusBadges("top")}
          {game.isGameActive && Object.keys(game.scores).length > 1 && (
            <MultiplayerScoreboard
              scores={game.scores}
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
