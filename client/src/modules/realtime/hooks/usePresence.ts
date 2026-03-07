/**
 * React hook for user presence tracking.
 * Shows who is online, their status, and typing indicators.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Awareness } from "y-protocols/awareness";
import { createPresence, type PresenceHandle, type UserPresence } from "../sync/awareness";

export interface UsePresenceResult {
  /** All online users (including self). */
  users: UserPresence[];
  /** Remote users only. */
  remoteUsers: UserPresence[];
  /** Set typing status. */
  setTyping: (isTyping: boolean) => void;
  /** Update local presence (name, status, etc.). */
  updatePresence: (partial: Partial<Omit<UserPresence, "userId">>) => void;
}

/**
 * Presence tracking hook.
 * Pass the awareness instance from the Yjs provider.
 */
export function usePresence(
  awareness: Awareness | null,
  userId: string,
  name: string,
  color: string,
): UsePresenceResult {
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<UserPresence[]>([]);
  const handleRef = useRef<PresenceHandle | null>(null);

  useEffect(() => {
    if (!awareness) return;

    const handle = createPresence(awareness, userId, name, color);
    handleRef.current = handle;

    // Set initial state
    setUsers(handle.getAllUsers());
    setRemoteUsers(handle.getRemoteUsers());

    const unsub = handle.onPresenceChange((allUsers) => {
      setUsers(allUsers);
      setRemoteUsers(allUsers.filter((u) => u.userId !== userId));
    });

    return () => {
      unsub();
      handle.destroy();
      handleRef.current = null;
    };
  }, [awareness, userId, name, color]);

  const setTyping = useCallback((isTyping: boolean) => {
    handleRef.current?.setTyping(isTyping);
  }, []);

  const updatePresence = useCallback((partial: Partial<Omit<UserPresence, "userId">>) => {
    handleRef.current?.setPresence(partial);
  }, []);

  return { users, remoteUsers, setTyping, updatePresence };
}
