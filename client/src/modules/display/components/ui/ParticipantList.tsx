import React from "react";
import type { Participant } from "@/types/room";
import { cn } from "@/lib/utils";

interface ParticipantListProps {
  participants: Participant[];
  /** ID of the local user (highlighted). */
  localUserId?: string;
}

/** Role badge colours. */
const ROLE_STYLES: Record<Participant["role"], string> = {
  host: "bg-amber-500/20 text-amber-300",
  student: "bg-blue-500/20 text-blue-300",
  observer: "bg-neutral-500/20 text-neutral-400",
};

/**
 * Displays the list of participants currently in the room.
 */
export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  localUserId,
}) => {
  if (participants.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Participants ({participants.length})
      </h3>
      <ul className="flex flex-col gap-0.5">
        {participants.map((p) => (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              p.id === localUserId ? "bg-white/5" : "hover:bg-white/5",
            )}
          >
            {/* Avatar circle with first letter */}
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-xs font-bold text-white">
              {p.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium text-white">
                {p.name}
                {p.id === localUserId && (
                  <span className="ml-1 text-xs text-neutral-500">(you)</span>
                )}
              </span>
            </div>

            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                ROLE_STYLES[p.role],
              )}
            >
              {p.role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
