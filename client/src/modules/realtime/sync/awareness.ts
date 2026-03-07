/**
 * User presence and awareness via Yjs awareness protocol.
 * Tracks who is online, typing status, and other presence info.
 */

import type { Awareness } from "y-protocols/awareness";
import { createLogger } from "@/lib/logger";

const log = createLogger("awareness");

export interface UserPresence {
  userId: string;
  name: string;
  color: string;
  status: "online" | "idle" | "away";
  isTyping: boolean;
  lastActiveAt: number;
}

export interface PresenceHandle {
  /** Set the local user's presence info. */
  setPresence: (presence: Partial<Omit<UserPresence, "userId">>) => void;
  /** Mark the user as typing (auto-clears after timeout). */
  setTyping: (isTyping: boolean) => void;
  /** Get all online users (excluding self). */
  getRemoteUsers: () => UserPresence[];
  /** Get all users including self. */
  getAllUsers: () => UserPresence[];
  /** Subscribe to presence changes. Returns unsubscribe function. */
  onPresenceChange: (cb: (users: UserPresence[]) => void) => () => void;
  destroy: () => void;
}

/** Auto-clear typing status after this many ms. */
const TYPING_TIMEOUT_MS = 3000;

/** User is considered idle after this many ms of inactivity. */
const IDLE_TIMEOUT_MS = 60_000;

/**
 * Create a presence handle for the local user.
 */
export function createPresence(
  awareness: Awareness,
  userId: string,
  name: string,
  color: string,
): PresenceHandle {
  const listeners = new Set<(users: UserPresence[]) => void>();
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setInterval> | null = null;

  // Set initial presence
  const initialPresence: UserPresence = {
    userId,
    name,
    color,
    status: "online",
    isTyping: false,
    lastActiveAt: Date.now(),
  };

  const currentState = awareness.getLocalState() ?? {};
  awareness.setLocalState({ ...currentState, presence: initialPresence });
  log.info("Presence initialized", { userId, name });

  function setPresence(partial: Partial<Omit<UserPresence, "userId">>) {
    const current = awareness.getLocalState() ?? {};
    const existing = (current.presence as UserPresence) ?? initialPresence;
    awareness.setLocalState({
      ...current,
      presence: { ...existing, ...partial, userId, lastActiveAt: Date.now() },
    });
  }

  function setTyping(isTyping: boolean) {
    setPresence({ isTyping });
    if (typingTimer) clearTimeout(typingTimer);
    if (isTyping) {
      typingTimer = setTimeout(() => {
        setPresence({ isTyping: false });
        typingTimer = null;
      }, TYPING_TIMEOUT_MS);
    }
  }

  function collectUsers(includeSelf: boolean): UserPresence[] {
    const users: UserPresence[] = [];
    awareness.getStates().forEach((state, clientId) => {
      if (!includeSelf && clientId === awareness.clientID) return;
      const presence = state.presence as UserPresence | undefined;
      if (presence?.userId) {
        users.push(presence);
      }
    });
    return users;
  }

  function handleAwarenessChange() {
    const users = collectUsers(true);
    listeners.forEach((cb) => cb(users));
  }

  awareness.on("change", handleAwarenessChange);

  // Periodic idle check
  idleTimer = setInterval(() => {
    const current = awareness.getLocalState() ?? {};
    const presence = current.presence as UserPresence | undefined;
    if (presence && presence.status === "online") {
      const elapsed = Date.now() - presence.lastActiveAt;
      if (elapsed > IDLE_TIMEOUT_MS) {
        setPresence({ status: "idle" });
      }
    }
  }, 15_000);

  function onPresenceChange(cb: (users: UserPresence[]) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  function destroy() {
    if (typingTimer) clearTimeout(typingTimer);
    if (idleTimer) clearInterval(idleTimer);
    awareness.off("change", handleAwarenessChange);
    listeners.clear();
    log.info("Presence destroyed", { userId });
  }

  return {
    setPresence,
    setTyping,
    getRemoteUsers: () => collectUsers(false),
    getAllUsers: () => collectUsers(true),
    onPresenceChange,
    destroy,
  };
}
