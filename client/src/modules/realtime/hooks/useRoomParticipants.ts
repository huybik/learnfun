import { useMemo } from "react";
import type { Participant as LkParticipant } from "livekit-client";
import type { Participant } from "@/types/room";

/** Map LiveKit participants to our app Participant type. */
function toLkParticipants(lkParticipants: LkParticipant[], hostIdentity?: string): Participant[] {
  return lkParticipants.map((p) => ({
    id: p.identity,
    name: p.name || p.identity,
    role: p.identity === hostIdentity ? ("host" as const) : ("student" as const),
    joinedAt: new Date().toISOString(),
    livekitIdentity: p.identity,
  }));
}

export interface UseRoomParticipantsResult {
  participants: Participant[];
  localUserId: string;
}

/**
 * Maps LiveKit participants to app Participant type.
 * Falls back to a local-only participant when LiveKit has no participants.
 */
export function useRoomParticipants(
  lkParticipants: LkParticipant[],
  localParticipant: LkParticipant | undefined,
  fallbackUserName: string,
): UseRoomParticipantsResult {
  const participants = useMemo<Participant[]>(() => {
    if (lkParticipants.length > 0) {
      return toLkParticipants(lkParticipants, localParticipant?.identity);
    }
    return [
      {
        id: "local-user",
        name: fallbackUserName,
        role: "host",
        joinedAt: new Date().toISOString(),
        livekitIdentity: "local-user",
      },
    ];
  }, [lkParticipants, localParticipant?.identity, fallbackUserName]);

  const localUserId = localParticipant?.identity ?? "local-user";

  return { participants, localUserId };
}
