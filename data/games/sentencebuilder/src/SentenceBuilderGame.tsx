"use client";

/**
 * Sentence Builder Game: reorder words to build the correct sentence.
 * Ported from old code, adapted for multiplayer (state via GameContext).
 */

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useGameContext } from "@/modules/display/hooks/useGameState";

interface WordBlock {
  id: number;
  text: string;
  isUsed: boolean;
}

interface SentenceSlot {
  id: number;
  text: string;
}

/** Fisher-Yates shuffle. */
function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const SentenceBuilderGame: React.FC = () => {
  const { initialData, updateGameStateForAI, endGame } = useGameContext();
  const [wordBank, setWordBank] = useState<WordBlock[]>([]);
  const [sentenceSlots, setSentenceSlots] = useState<SentenceSlot[]>([]);
  const [correctSentence, setCorrectSentence] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "correct" | "incorrect" | "info";
  } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Initialization ----
  useEffect(() => {
    try {
      setError(null);
      setFeedback({ message: "Build the sentence!", type: "info" });
      setIsComplete(false);

      if (
        !initialData ||
        !Array.isArray(initialData.words) ||
        initialData.words.length === 0 ||
        typeof initialData.correctSentence !== "string" ||
        (initialData.correctSentence as string).trim() === ""
      ) {
        throw new Error("Requires 'words' (array) and 'correctSentence' (string).");
      }

      const words = initialData.words as string[];
      const distractors = (initialData.distractors as string[] | undefined) ?? [];
      const all = [...words, ...distractors];

      setWordBank(shuffle(all.map((w, i) => ({ id: i, text: w, isUsed: false }))));
      setSentenceSlots([]);
      setCorrectSentence(initialData.correctSentence as string);
      setPrompt((initialData.prompt as string | undefined) ?? null);
      updateGameStateForAI({
        status: "playing",
        message: "SentenceBuilder game started.",
        wordsInBank: all.length,
        targetLength: (initialData.correctSentence as string).split(" ").length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Initialization failed: ${msg}`);
      updateGameStateForAI({ status: "error", message: `Init failed: ${msg}` });
    }
  }, [initialData, updateGameStateForAI]);

  // ---- Word bank click -> add to sentence ----
  const handleWordClick = useCallback(
    (word: WordBlock) => {
      if (word.isUsed || isComplete) return;
      setSentenceSlots((prev) => [...prev, { id: word.id, text: word.text }]);
      setWordBank((prev) => prev.map((w) => (w.id === word.id ? { ...w, isUsed: true } : w)));
      setFeedback(null);
    },
    [isComplete],
  );

  // ---- Sentence slot click -> return to bank ----
  const handleSlotClick = useCallback(
    (slot: SentenceSlot, index: number) => {
      if (isComplete) return;
      setSentenceSlots((prev) => prev.filter((_, i) => i !== index));
      setWordBank((prev) => prev.map((w) => (w.id === slot.id ? { ...w, isUsed: false } : w)));
      setFeedback(null);
    },
    [isComplete],
  );

  // ---- Check sentence ----
  const handleCheck = useCallback(() => {
    if (isComplete || sentenceSlots.length === 0) return;
    const built = sentenceSlots.map((s) => s.text).join(" ");
    const isCorrect = built.trim().toLowerCase() === correctSentence.trim().toLowerCase();

    if (isCorrect) {
      setFeedback({ message: "Correct!", type: "correct" });
      setIsComplete(true);
      updateGameStateForAI({ status: "correct", finalSentence: built });
      setTimeout(() => endGame({ outcome: "completed", finalScore: 10 }), 1500);
    } else {
      setFeedback({ message: "Not quite right. Try again!", type: "incorrect" });
      updateGameStateForAI({ status: "incorrect_attempt", submittedSentence: built });
    }
  }, [sentenceSlots, correctSentence, isComplete, updateGameStateForAI, endGame]);

  // ---- Error state ----
  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-neutral-900 text-white">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={() => endGame({ outcome: "failed", reason: error })}
          className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-700"
        >
          Exit Game
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-neutral-900 p-6">
      {/* Prompt */}
      {prompt && (
        <div className="rounded-lg bg-neutral-800 px-6 py-3 text-center text-lg font-medium text-white shadow">
          {prompt}
        </div>
      )}

      {/* Sentence construction area */}
      <div className="flex min-h-[4rem] w-full max-w-lg flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 p-4">
        {sentenceSlots.length === 0 && !isComplete && (
          <span className="text-sm text-neutral-500">Click words below to add them here...</span>
        )}
        {sentenceSlots.map((slot, i) => (
          <button
            key={`${slot.id}-${i}`}
            onClick={() => handleSlotClick(slot, i)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:bg-blue-700"
            title="Click to remove"
          >
            {slot.text}
          </button>
        ))}
      </div>

      {/* Feedback */}
      <div
        className={cn(
          "min-h-[1.5rem] text-sm font-medium",
          feedback?.type === "correct" && "text-green-400",
          feedback?.type === "incorrect" && "text-red-400",
          feedback?.type === "info" && "text-neutral-400",
        )}
      >
        {feedback?.message ?? ""}
      </div>

      {/* Word bank */}
      {!isComplete && (
        <div className="flex flex-wrap justify-center gap-2">
          {wordBank.map((word) => (
            <button
              key={word.id}
              onClick={() => handleWordClick(word)}
              disabled={word.isUsed}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium shadow transition",
                word.isUsed
                  ? "cursor-not-allowed bg-neutral-800 text-neutral-600 opacity-50"
                  : "bg-neutral-700 text-white hover:bg-neutral-600",
              )}
            >
              {word.text}
            </button>
          ))}
        </div>
      )}

      {/* Check button */}
      <button
        onClick={handleCheck}
        disabled={sentenceSlots.length === 0 || isComplete}
        className={cn(
          "rounded-lg px-6 py-2 text-sm font-medium text-white",
          sentenceSlots.length > 0 && !isComplete
            ? "bg-green-600 hover:bg-green-700"
            : "cursor-not-allowed bg-neutral-700 opacity-50",
        )}
      >
        Check Sentence
      </button>
    </div>
  );
};
