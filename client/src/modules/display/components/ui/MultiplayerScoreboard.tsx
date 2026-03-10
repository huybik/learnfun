import React, { useMemo } from "react";
import type { Participant } from "@/types/room";
import { cn } from "@/lib/utils";

interface MultiplayerScoreboardProps {
  scores: Record<string, number>;
  participants: Participant[];
  localUserId?: string;
}

/**
 * Floating multiplayer scoreboard. Only renders when 2+ players have scores.
 */
export const MultiplayerScoreboard: React.FC<MultiplayerScoreboardProps> = ({
  scores,
  participants,
  localUserId,
}) => {
  const rows = useMemo(() => {
    const nameMap = new Map(participants.map((p) => [p.id, p.name]));
    return Object.entries(scores)
      .map(([id, score]) => ({ id, name: nameMap.get(id) ?? id, score }))
      .sort((a, b) => b.score - a.score);
  }, [scores, participants]);

  if (rows.length < 2) return null;

  return (
    <div className="absolute left-4 top-4 z-40 rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm">
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        Scoreboard
      </h4>
      <ul className="flex flex-col gap-0.5">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={cn(
              "flex items-center justify-between gap-4 text-xs",
              r.id === localUserId ? "font-bold text-white" : "text-neutral-300",
            )}
          >
            <span className="truncate">
              {i + 1}. {r.name}
              {r.id === localUserId && <span className="ml-1 text-neutral-500">(you)</span>}
            </span>
            <span className="tabular-nums">{r.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
