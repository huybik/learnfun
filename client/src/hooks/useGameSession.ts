/**
 * useGameSession — encapsulates game lifecycle, multiplayer sync,
 * score attribution, and teacher communication.
 * Extracted from Room.tsx for clarity.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSync } from "@/modules/realtime/hooks/useSync";
import type { SyncStore } from "@/modules/realtime/sync/sync-store";
import type { GameHostHandle } from "@/modules/display/components/GameHost";
import type {
  ContentReadyPayload,
  GameActionPayload,
} from "@/modules/realtime/hooks/useServerEvents";
import type { FilledBundle } from "@/types/content";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createActionId(): string {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseInitData(bundle: FilledBundle): Record<string, unknown> {
  const raw = bundle.filledSlots["game_data"];
  if (!raw) return bundle.filledSlots;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return bundle.filledSlots;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedbackState = { type: "correct" | "incorrect"; key: number; points?: number };

export interface UseGameSessionOptions {
  syncStore: SyncStore | null;
  roomId: string;
  localUserId: string | null;
  roomHostId: string | null;
  roomParticipants: Array<{ id: string; name: string }>;
  addTranscript: (source: "user" | "ai" | "system", text: string) => void;
}

export interface UseGameSessionResult {
  /** Ref to attach to <GameHost> — the hook sends actions through it. */
  gameHostRef: React.RefObject<GameHostHandle | null>;

  // Game state
  gameId: string | undefined;
  gameInitData: Record<string, unknown> | undefined;
  isGameActive: boolean;
  isLeader: boolean;
  isFollower: boolean;

  // Score / HUD
  score: number;
  streak: number;
  feedback: FeedbackState | null;
  hasOwnHUD: boolean;
  scores: Record<string, number>;

  // Multiplayer
  gamePeers: Array<{ id: string; name: string; score: number; phase: string | null }> | undefined;
  gameReady: boolean;
  localPhase: string | null;

  // GameHost callbacks (wire to <Board> / <GameHost>)
  handleGameStateUpdate: (state: Record<string, unknown>) => void;
  handleGameEvent: (name: string, data: Record<string, unknown>) => void;
  handleGameEnd: (results?: Record<string, unknown>) => void;
  handleGameReady: () => void;

  // SSE handlers (wire to useServerEvents)
  handleContentReady: (event: ContentReadyPayload) => void;
  handleGameAction: (data: GameActionPayload) => void;

  // Actions
  endGame: () => void;
  sendToTeacher: (text: string) => void;
  triggerFeedback: (type: "correct" | "incorrect", points?: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameSession(opts: UseGameSessionOptions): UseGameSessionResult {
  const { syncStore, roomId, localUserId, roomHostId, roomParticipants, addTranscript } = opts;

  // ---- Yjs sync ----
  const {
    gameState: syncedGame,
    updateGameState,
    setPlayerScore,
    setPlayerPhase,
    enqueuePendingAction,
    removePendingAction,
    clearPendingActions,
    clearPlayerState,
  } = useSync(syncStore);

  // ---- Refs ----
  const gameHostRef = useRef<GameHostHandle | null>(null);
  const screenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingActionFromRef = useRef<string | null>(null);
  const authoritativeScoreRef = useRef(0);
  const lastFollowerScoreRef = useRef<number | null>(null);

  // ---- Local state ----
  const [gameId, setGameId] = useState<string | undefined>();
  const [gameInitData, setGameInitData] = useState<Record<string, unknown> | undefined>();
  const [isGameActive, setIsGameActive] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [hasOwnHUD, setHasOwnHUD] = useState(false);
  const [gameReady, setGameReady] = useState(false);

  // ---- Leader / Follower ----
  const authoritativeLeaderId = roomHostId ?? syncedGame.leader ?? null;
  const isLeader = !!(localUserId && authoritativeLeaderId === localUserId);
  const isFollower = !!(localUserId && authoritativeLeaderId && authoritativeLeaderId !== localUserId);

  // Ensure leader is set in Yjs when room host joins
  useEffect(() => {
    if (!roomHostId || syncedGame.active || syncedGame.leader === roomHostId) return;
    updateGameState({ leader: roomHostId });
  }, [roomHostId, syncedGame.active, syncedGame.leader, updateGameState]);

  // Sync local game state from Yjs (also handles late-joiner bootstrap)
  useEffect(() => {
    if (syncedGame.active && syncedGame.type && syncedGame.initData) {
      setGameId(syncedGame.type);
      setGameInitData(syncedGame.initData);
      setIsGameActive(true);
      setHasOwnHUD(syncedGame.type === "fruit-market");
      return;
    }
    setGameId(undefined);
    setGameInitData(undefined);
    setIsGameActive(false);
    setGameReady(false);
    setHasOwnHUD(false);
  }, [syncedGame.active, syncedGame.type, syncedGame.initData]);

  // Reset on game change
  useEffect(() => {
    setGameReady(false);
    lastFollowerScoreRef.current = null;
  }, [gameId]);

  // Follower: score sync from Yjs → local → iframe
  useEffect(() => {
    if (!localUserId) return;
    const nextScore = syncedGame.scores[localUserId] ?? 0;
    setScore(nextScore);

    if (!isFollower || !gameReady) {
      lastFollowerScoreRef.current = null;
      return;
    }
    if (lastFollowerScoreRef.current === nextScore) return;
    lastFollowerScoreRef.current = nextScore;
    gameHostRef.current?.sendAction("set", { field: "score", value: nextScore });
  }, [localUserId, syncedGame.scores, isFollower, gameReady]);

  // Leader: dequeue pending actions → forward to game iframe
  useEffect(() => {
    if (!isLeader || !gameReady || syncedGame.pendingActions.length === 0) return;
    const { id, from, name, params } = syncedGame.pendingActions[0];
    pendingActionFromRef.current = name === "_getFullState" ? null : from;
    gameHostRef.current?.sendAction(name, params);
    removePendingAction(id);
  }, [gameReady, isLeader, syncedGame.pendingActions, removePendingAction]);

  // Follower: watch fullState → push _sync to iframe
  useEffect(() => {
    if (!isFollower || !gameReady || !syncedGame.fullState) return;
    gameHostRef.current?.sendAction("_sync", { state: syncedGame.fullState });
  }, [gameReady, isFollower, syncedGame.fullState]);

  // ---- Teacher communication ----

  const sendToTeacher = useCallback(
    (text: string) => {
      fetch("/api/teacher/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, text }),
      }).catch((err) => console.error("[GameSession] Teacher message error", err));
    },
    [roomId],
  );

  // ---- Shared cleanup helpers ----

  const resetLeaderState = useCallback(() => {
    authoritativeScoreRef.current = 0;
    pendingActionFromRef.current = null;
    clearPendingActions();
    clearPlayerState();
  }, [clearPendingActions, clearPlayerState]);

  const clearYjsGame = useCallback(() => {
    updateGameState({
      active: false,
      type: null,
      leader: null,
      initData: null,
      fullState: null,
      data: {},
      turnOrder: [],
    });
  }, [updateGameState]);

  const persistScores = useCallback(
    (details?: Record<string, unknown>) => {
      if (Object.keys(syncedGame.scores).length === 0) return;
      fetch("/api/game/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          gameType: syncedGame.type ?? "unknown",
          scores: syncedGame.scores,
          details: details ?? {},
        }),
      }).catch((err) => console.error("[GameSession] Score persist error", err));
    },
    [roomId, syncedGame.scores, syncedGame.type],
  );

  const clearScreenshotTimer = () => {
    if (screenshotTimerRef.current) {
      clearTimeout(screenshotTimerRef.current);
      screenshotTimerRef.current = null;
    }
  };

  // ---- Feedback ----

  const triggerFeedback = useCallback((type: "correct" | "incorrect", points?: number) => {
    setFeedback({ type, key: Date.now(), points });
  }, []);

  // ---- Game lifecycle callbacks ----

  const activateBundle = useCallback(
    (bundle: FilledBundle) => {
      const initData = parseInitData(bundle);
      const templateId = bundle.templateId.toLowerCase();

      setGameId(templateId);
      setGameInitData(initData);
      setIsGameActive(true);
      setScore(0);
      setStreak(0);
      setFeedback(null);
      setHasOwnHUD(templateId === "fruit-market");
      authoritativeScoreRef.current = 0;
      pendingActionFromRef.current = null;
      clearPendingActions();
      clearPlayerState();
      addTranscript("system", "Content loaded!");

      const leader = roomHostId || syncedGame.leader || localUserId || null;
      updateGameState({
        active: true,
        type: templateId,
        leader,
        initData,
        fullState: null,
        data: {},
        turnOrder: [],
      });
    },
    [addTranscript, clearPendingActions, clearPlayerState, updateGameState, roomHostId, syncedGame.leader, localUserId],
  );

  const handleContentReady = useCallback(
    (event: ContentReadyPayload) => {
      console.log("[GameSession] SSE content_ready", { contentId: event.payload.contentId });
      activateBundle(event.payload.bundle as FilledBundle);
    },
    [activateBundle],
  );

  const handleGameStateUpdate = useCallback(
    (state: Record<string, unknown>) => {
      if (state.hasOwnHUD) setHasOwnHUD(true);
      if (localUserId) {
        setPlayerPhase(localUserId, (state.phase as string) ?? null);
      }

      // Leader: attribute score delta to acting player
      if (isLeader && typeof state.score === "number") {
        const delta = state.score - authoritativeScoreRef.current;
        const actedBy = pendingActionFromRef.current || localUserId;
        if (actedBy && delta !== 0) {
          const next = Math.max(0, (syncedGame.scores[actedBy] || 0) + delta);
          setPlayerScore(actedBy, next);
        }
        authoritativeScoreRef.current = state.score;
      }
      pendingActionFromRef.current = null;

      if (isLeader) {
        sendToTeacher(`[game_state_update] ${JSON.stringify(state)}`);
      }
    },
    [sendToTeacher, localUserId, setPlayerPhase, isLeader, setPlayerScore, syncedGame.scores],
  );

  const handleGameEvent = useCallback(
    (name: string, data: Record<string, unknown>) => {
      // Leader: _fullState → broadcast via Yjs
      if (name === "_fullState") {
        if (isLeader) {
          updateGameState({ fullState: data.state as Record<string, unknown> });
        }
        return;
      }

      // Follower: relay actions to leader via Yjs queue
      if (name === "_relay" && isFollower && localUserId) {
        enqueuePendingAction({
          id: createActionId(),
          from: localUserId,
          name: data.name as string,
          params: (data.params as Record<string, unknown>) ?? {},
          ts: Date.now(),
        });
        return;
      }

      // Local feedback (all players)
      if (name === "correctAnswer") {
        setStreak((s) => s + 1);
        triggerFeedback("correct", 10);
      } else if (name === "incorrectAnswer") {
        setStreak(0);
        triggerFeedback("incorrect");
      }

      // Leader: forward to teacher + capture screenshot
      if (isLeader) {
        if (name === "gameStarted") {
          clearScreenshotTimer();
          screenshotTimerRef.current = setTimeout(async () => {
            screenshotTimerRef.current = null;
            const dataUrl = await gameHostRef.current?.captureScreenshot();
            if (dataUrl) {
              fetch("/api/teacher/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomId, imageBase64: dataUrl }),
              }).catch((err) => console.error("[GameSession] Screenshot send error", err));
            }
          }, 500);
        }
        sendToTeacher(`[game_event:${name}] ${JSON.stringify(data)}`);
      }
    },
    [sendToTeacher, roomId, isLeader, isFollower, localUserId, updateGameState, enqueuePendingAction, triggerFeedback],
  );

  /** Called when the game iframe signals natural completion. */
  const handleGameEnd = useCallback(
    (results?: Record<string, unknown>) => {
      clearScreenshotTimer();
      setIsGameActive(false);
      if (!isLeader) return;

      if (results) {
        sendToTeacher(`[game_event:gameEnd] ${JSON.stringify(results)}`);
      }
      persistScores(results);
      resetLeaderState();
      clearYjsGame();
    },
    [isLeader, sendToTeacher, persistScores, resetLeaderState, clearYjsGame],
  );

  /** Called when the user manually closes the game (leader only). */
  const endGame = useCallback(() => {
    clearScreenshotTimer();
    if (!isLeader) return;

    sendToTeacher(`[game_event:gameEnd] ${JSON.stringify({ outcome: "closed_by_user" })}`);
    persistScores();
    resetLeaderState();
    setIsGameActive(false);
    setGameId(undefined);
    setGameInitData(undefined);
    clearYjsGame();
  }, [isLeader, sendToTeacher, persistScores, resetLeaderState, clearYjsGame]);

  /** Called when the game iframe reports ready. */
  const handleGameReady = useCallback(() => {
    setGameReady(true);
    if (!isFollower) return;

    if (syncedGame.fullState) {
      gameHostRef.current?.sendAction("_sync", { state: syncedGame.fullState });
      return;
    }
    if (!localUserId) return;
    enqueuePendingAction({
      id: createActionId(),
      from: localUserId,
      name: "_getFullState",
      params: {},
      ts: Date.now(),
    });
  }, [enqueuePendingAction, isFollower, localUserId, syncedGame.fullState]);

  /** SSE game_action from teacher → forward to iframe. */
  const handleGameAction = useCallback(
    (data: GameActionPayload) => {
      if (data.target_player && data.target_player !== localUserId) return;
      console.log("[GameSession] SSE game_action", data);
      gameHostRef.current?.sendAction(data.action, data.params);
    },
    [localUserId],
  );

  // ---- Derived values ----

  const gamePeers = useMemo(() => {
    if (!syncedGame.active || Object.keys(syncedGame.scores).length < 2) return undefined;
    return roomParticipants
      .filter((p) => p.id in syncedGame.scores)
      .map((p) => ({
        id: p.id,
        name: p.name,
        score: syncedGame.scores[p.id] ?? 0,
        phase: (syncedGame.data?.[`${p.id}_phase`] as string) ?? null,
      }));
  }, [syncedGame, roomParticipants]);

  const localPhase = useMemo(() => {
    if (!localUserId) return null;
    return (syncedGame.data?.[`${localUserId}_phase`] as string) ?? null;
  }, [localUserId, syncedGame.data]);

  return {
    gameHostRef,
    gameId,
    gameInitData,
    isGameActive,
    isLeader,
    isFollower,
    score,
    streak,
    feedback,
    hasOwnHUD,
    scores: syncedGame.scores,
    gamePeers,
    gameReady,
    localPhase,
    handleGameStateUpdate,
    handleGameEvent,
    handleGameEnd,
    handleGameReady,
    handleContentReady,
    handleGameAction,
    endGame,
    sendToTeacher,
    triggerFeedback,
  };
}
