import React, { useEffect, useState, useCallback, useRef } from "react";

/** A single emote/celebration effect. */
interface EmoteInstance {
  id: string;
  emoji: string;
  x: number; // 0-100 (%)
  startY: number; // starting Y (typically 100 = bottom)
}

interface EmoteOverlayProps {
  /** Trigger a new emote by changing this value. */
  trigger: { emoji: string; key: number } | null;
  /** Whether confetti burst mode is active. */
  confetti?: boolean;
}

const CONFETTI_EMOJIS = ["🎉", "🎊", "✨", "⭐", "💫", "🌟"];
const EMOTE_LIFETIME_MS = 2500;

/**
 * Celebration effects overlay: floating emotes and confetti bursts.
 * Emojis rise from the bottom and fade out.
 */
export const EmoteOverlay: React.FC<EmoteOverlayProps> = ({
  trigger,
  confetti = false,
}) => {
  const [emotes, setEmotes] = useState<EmoteInstance[]>([]);
  const idCounter = useRef(0);

  const addEmote = useCallback((emoji: string) => {
    const id = `emote-${idCounter.current++}`;
    const x = 20 + Math.random() * 60; // random horizontal position 20-80%
    setEmotes((prev) => [...prev, { id, emoji, x, startY: 100 }]);

    setTimeout(() => {
      setEmotes((prev) => prev.filter((e) => e.id !== id));
    }, EMOTE_LIFETIME_MS);
  }, []);

  // React to trigger changes
  useEffect(() => {
    if (!trigger) return;
    addEmote(trigger.emoji);
  }, [trigger, addEmote]);

  // Confetti burst
  useEffect(() => {
    if (!confetti) return;
    const count = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const delay = i * 80;
      setTimeout(() => {
        const emoji = CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)];
        addEmote(emoji);
      }, delay);
    }
  }, [confetti, addEmote]);

  if (emotes.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {emotes.map((emote) => (
        <div
          key={emote.id}
          className="absolute text-3xl"
          style={{
            left: `${emote.x}%`,
            bottom: 0,
            animation: `emoteRise ${EMOTE_LIFETIME_MS}ms ease-out forwards`,
          }}
        >
          {emote.emoji}
        </div>
      ))}

      {/* Inline keyframes for the rise animation */}
      <style>{`
        @keyframes emoteRise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateY(-60vh) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
