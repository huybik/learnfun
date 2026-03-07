import React, { useEffect, useState, useCallback, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Focus Highlight                                                    */
/* ------------------------------------------------------------------ */

interface FocusHighlightProps {
  /** Focus point coordinates, normalised 0-1. Null = no focus. */
  point: { x: number; y: number } | null;
  /** Duration in ms before the highlight auto-fades. */
  duration?: number;
}

/**
 * AI Teacher's focus highlight: a pulsing ring at (x,y) on the board surface.
 * Coordinates are normalised 0-1 (relative to the board).
 */
const FocusHighlight: React.FC<FocusHighlightProps> = ({
  point,
  duration = 4000,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!point) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [point, duration]);

  if (!point || !visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      <div
        className="absolute"
        style={{
          left: `${point.x * 100}%`,
          top: `${point.y * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Outer pulse ring */}
        <div className="absolute -inset-4 animate-ping rounded-full border-2 border-yellow-400 opacity-60" />
        {/* Middle ring */}
        <div className="absolute -inset-2 animate-pulse rounded-full border-2 border-yellow-300 opacity-80" />
        {/* Center dot */}
        <div className="h-4 w-4 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Emote Overlay                                                      */
/* ------------------------------------------------------------------ */

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
 * Celebration effects: floating emotes and confetti bursts.
 * Emojis rise from the bottom and fade out.
 */
const EmoteOverlay: React.FC<EmoteOverlayProps> = ({
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

/* ------------------------------------------------------------------ */
/*  Combined ScreenEffects                                             */
/* ------------------------------------------------------------------ */

export interface ScreenEffectsProps {
  /** AI teacher focus highlight point. */
  focusPoint?: { x: number; y: number } | null;
  /** Focus highlight duration in ms. */
  focusDuration?: number;
  /** Emote trigger. */
  emoteTrigger?: { emoji: string; key: number } | null;
  /** Confetti mode active. */
  confetti?: boolean;
}

/**
 * All pointer-events-none screen overlay effects in one component:
 * focus highlights and emote/confetti celebrations.
 */
export const ScreenEffects: React.FC<ScreenEffectsProps> = ({
  focusPoint = null,
  focusDuration,
  emoteTrigger = null,
  confetti = false,
}) => (
  <>
    <FocusHighlight point={focusPoint} duration={focusDuration} />
    <EmoteOverlay trigger={emoteTrigger} confetti={confetti} />
  </>
);
