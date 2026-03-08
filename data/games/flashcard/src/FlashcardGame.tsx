"use client";

/**
 * Flashcard Game with 3 sub-modes:
 *   - ImageToWord: show image, user types the word
 *   - ListeningWordToImage: AI speaks a word, user clicks the matching image
 *   - SentenceCompletion: fill in the blank
 *
 * Ported from old code, adapted for multiplayer (state via GameContext).
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useGameContext } from "@/modules/display/hooks/useGameState";

// ---- Sub-mode data shapes ----
interface FlashcardImageToWord {
  id: number | string;
  image_data: string;
  answer: string;
}

interface FlashcardListeningItem {
  id: number | string;
  image_data: string;
  word: string;
}

interface FlashcardSentenceCompletion {
  id: number | string;
  sentence_template: string;
  missing_word: string;
  options?: string[];
}

type GameMode = "ImageToWord" | "ListeningWordToImage" | "SentenceCompletion" | null;

const FLIP_DURATION_MS = 600;

export const FlashcardGame: React.FC = () => {
  const { initialData, updateGameStateForAI, endGame } = useGameContext();

  // ---- State ----
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "correct" | "incorrect" | "info";
  } | null>(null);

  // ImageToWord
  const [cardsImageToWord, setCardsImageToWord] = useState<FlashcardImageToWord[]>([]);
  const [userInput, setUserInput] = useState("");

  // ListeningWordToImage
  const [listeningItems, setListeningItems] = useState<FlashcardListeningItem[]>([]);
  const [currentItemIdToFind, setCurrentItemIdToFind] = useState<number | string | null>(null);
  const [spokenWord, setSpokenWord] = useState<string | null>(null);
  const [clickedFeedback, setClickedFeedback] = useState<{
    id: number | string;
    type: "correct" | "incorrect";
  } | null>(null);

  // SentenceCompletion
  const [cardsSentenceCompletion, setCardsSentenceCompletion] = useState<FlashcardSentenceCompletion[]>([]);

  // ---- Initialization ----
  useEffect(() => {
    try {
      setError(null);
      setIsComplete(false);
      setScore(0);
      setFeedback(null);
      setShowNextButton(false);
      setUserInput("");
      setClickedFeedback(null);
      setIsFlipped(false);
      setCurrentIndex(0);

      if (!initialData || !initialData.sub_type) {
        throw new Error("Invalid initial data: Missing 'sub_type'.");
      }

      const mode = initialData.sub_type as GameMode;
      setGameMode(mode);
      let itemsCount = 0;
      let initialFeedback = "Loading...";

      if (mode === "ImageToWord") {
        const validCards = (initialData.cards as FlashcardImageToWord[] | undefined)?.filter(
          (c) => c.id && c.image_data && c.answer,
        );
        if (!validCards?.length) throw new Error("No valid ImageToWord cards.");
        setCardsImageToWord(validCards);
        itemsCount = validCards.length;
        initialFeedback = "Type or say the word for the image.";
      } else if (mode === "ListeningWordToImage") {
        const validItems = (initialData.items as FlashcardListeningItem[] | undefined)?.filter(
          (i) => i.id && i.image_data && i.word,
        );
        if (!validItems?.length) throw new Error("No valid ListeningWordToImage items.");
        setListeningItems(validItems);
        itemsCount = validItems.length;
        initialFeedback = "Listen for the word and click the image.";
        setTimeout(() => triggerAISpeech(validItems), 500);
      } else if (mode === "SentenceCompletion") {
        const validCards = (initialData.cards as FlashcardSentenceCompletion[] | undefined)?.filter(
          (c) => c.id && c.sentence_template && c.missing_word,
        );
        if (!validCards?.length) throw new Error("No valid SentenceCompletion cards.");
        setCardsSentenceCompletion(validCards);
        itemsCount = validCards.length;
        initialFeedback = "Complete the sentence.";
      } else {
        throw new Error(`Unsupported flashcard sub_type: ${mode}`);
      }

      setFeedback({ message: initialFeedback, type: "info" });
      updateGameStateForAI({ status: "playing", message: `${mode} Flashcard started. Items: ${itemsCount}.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Initialization failed: ${msg}`);
      updateGameStateForAI({ status: "error", message: `Init failed: ${msg}` });
    }
  }, [initialData, updateGameStateForAI]);

  // ---- Listening: trigger AI speech ----
  const triggerAISpeech = useCallback(
    (items: FlashcardListeningItem[]) => {
      if (items.length === 0 || isComplete) return;
      const next = items[0];
      setCurrentItemIdToFind(next.id);
      setSpokenWord(next.word);
      setFeedback({ message: `Click the image for: "${next.word}"`, type: "info" });
      setClickedFeedback(null);
      updateGameStateForAI({
        status: "waiting_for_ai_speech",
        targetWord: next.word,
        itemsRemaining: items.length,
      });
    },
    [isComplete, updateGameStateForAI],
  );

  // ---- Check answer (ImageToWord / SentenceCompletion) ----
  const checkAnswer = useCallback(
    (answer: string) => {
      if (isComplete || showNextButton) return;
      let correctAnswer = "";

      if (gameMode === "ImageToWord" && cardsImageToWord[currentIndex]) {
        correctAnswer = cardsImageToWord[currentIndex].answer;
      } else if (gameMode === "SentenceCompletion" && cardsSentenceCompletion[currentIndex]) {
        correctAnswer = cardsSentenceCompletion[currentIndex].missing_word;
      } else {
        return;
      }

      setIsFlipped(true);
      const isCorrect = answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

      if (isCorrect) {
        setFeedback({ message: "Correct!", type: "correct" });
        setScore((s) => s + 10);
        updateGameStateForAI({ status: "correct_answer", itemIndex: currentIndex, score: score + 10 });
      } else {
        setFeedback({ message: `Incorrect. Answer: ${correctAnswer}`, type: "incorrect" });
        updateGameStateForAI({ status: "incorrect_answer", itemIndex: currentIndex, score });
      }
      setShowNextButton(true);
      setUserInput("");
    },
    [currentIndex, cardsImageToWord, cardsSentenceCompletion, gameMode, isComplete, showNextButton, score, updateGameStateForAI],
  );

  // ---- Advance card ----
  const advanceCard = () => {
    const total = gameMode === "ImageToWord" ? cardsImageToWord.length : cardsSentenceCompletion.length;
    if (currentIndex < total - 1) {
      setIsFlipped(false);
      setShowNextButton(false);
      setTimeout(() => {
        const next = currentIndex + 1;
        setCurrentIndex(next);
        setUserInput("");
        setFeedback({
          message: gameMode === "ImageToWord" ? "Type or say the word for the image." : "Complete the sentence.",
          type: "info",
        });
        updateGameStateForAI({ status: "playing", itemIndex: next, score });
      }, FLIP_DURATION_MS / 2);
    } else {
      setIsComplete(true);
      setFeedback({ message: "All items finished!", type: "info" });
      updateGameStateForAI({ status: "completed", score });
      setTimeout(() => endGame({ outcome: "completed", finalScore: score }), 1500);
    }
  };

  // ---- Listening: image click ----
  const handleImageClick = useCallback(
    (clicked: FlashcardListeningItem) => {
      if (isComplete || !currentItemIdToFind || clickedFeedback) return;

      if (clicked.id === currentItemIdToFind) {
        setScore((s) => s + 10);
        setClickedFeedback({ id: clicked.id, type: "correct" });
        setFeedback({ message: "Correct!", type: "correct" });
        const remaining = listeningItems.filter((i) => i.id !== clicked.id);
        setListeningItems(remaining);
        updateGameStateForAI({ status: "correct_selection", itemsRemaining: remaining.length, score: score + 10 });
        setTimeout(() => {
          if (remaining.length === 0) {
            setIsComplete(true);
            setFeedback({ message: "All items matched!", type: "info" });
            updateGameStateForAI({ status: "completed", score: score + 10 });
            setTimeout(() => endGame({ outcome: "completed", finalScore: score + 10 }), 1500);
          } else {
            triggerAISpeech(remaining);
          }
        }, 1000);
      } else {
        setClickedFeedback({ id: clicked.id, type: "incorrect" });
        setFeedback({ message: "Try again!", type: "incorrect" });
        updateGameStateForAI({ status: "incorrect_selection", itemsRemaining: listeningItems.length, score });
        setTimeout(() => {
          setClickedFeedback(null);
          setFeedback({ message: `Click the image for: "${spokenWord}"`, type: "info" });
        }, 1000);
      }
    },
    [listeningItems, currentItemIdToFind, isComplete, spokenWord, score, clickedFeedback, updateGameStateForAI, endGame, triggerAISpeech],
  );

  // ---- Get correct answer for card back ----
  const getCorrectAnswer = useCallback(() => {
    if (gameMode === "ImageToWord" && cardsImageToWord[currentIndex]) return cardsImageToWord[currentIndex].answer;
    if (gameMode === "SentenceCompletion" && cardsSentenceCompletion[currentIndex]) return cardsSentenceCompletion[currentIndex].missing_word;
    return null;
  }, [gameMode, currentIndex, cardsImageToWord, cardsSentenceCompletion]);

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

  // ---- Card renderers ----
  const renderCardFront = () => {
    if (gameMode === "ImageToWord") {
      const card = cardsImageToWord[currentIndex];
      if (!card) return null;
      return (
        <div className="flex h-full items-center justify-center p-4">
          <img
            src={`data:image/jpeg;base64,${card.image_data}`}
            alt={`Flashcard ${currentIndex + 1}`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      );
    }
    if (gameMode === "SentenceCompletion") {
      const card = cardsSentenceCompletion[currentIndex];
      if (!card) return null;
      const parts = card.sentence_template.split("____");
      return (
        <div className="flex h-full items-center justify-center p-6">
          <p className="text-center text-xl leading-relaxed text-white">
            {parts[0]}
            <span className="mx-2 inline-block w-24 border-b-2 border-dashed border-white/50" />
            {parts[1]}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCardBack = () => {
    const answer = getCorrectAnswer();
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
        <p className="text-sm text-neutral-400">Answer:</p>
        <p className="text-2xl font-bold text-white">{answer ?? "..."}</p>
      </div>
    );
  };

  // ---- ListeningWordToImage mode ----
  const renderListeningMode = () => (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-4">
      <div className="rounded-lg bg-neutral-800 px-6 py-3 text-lg font-medium text-white">
        {feedback?.message ?? "Listen carefully..."}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {listeningItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleImageClick(item)}
            className={cn(
              "overflow-hidden rounded-xl border-2 transition-all",
              clickedFeedback?.id === item.id && clickedFeedback.type === "correct"
                ? "border-green-400 ring-2 ring-green-400"
                : clickedFeedback?.id === item.id && clickedFeedback.type === "incorrect"
                  ? "border-red-400 ring-2 ring-red-400"
                  : "border-white/10 hover:border-white/30",
            )}
          >
            <img
              src={`data:image/jpeg;base64,${item.image_data}`}
              alt={`Item ${item.id}`}
              className="h-32 w-32 object-cover sm:h-40 sm:w-40"
            />
          </button>
        ))}
      </div>
    </div>
  );

  // ---- Main render ----
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-neutral-900 p-4">
      {gameMode === "ListeningWordToImage" ? (
        renderListeningMode()
      ) : gameMode === "ImageToWord" || gameMode === "SentenceCompletion" ? (
        <>
          {/* Flip card */}
          <div className="perspective-[1200px] h-64 w-full max-w-sm">
            <div
              className={cn(
                "relative h-full w-full transition-transform duration-[600ms] [transform-style:preserve-3d]",
                isFlipped && "[transform:rotateY(180deg)]",
              )}
            >
              {/* Front */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl bg-neutral-800 shadow-xl [backface-visibility:hidden]">
                {renderCardFront()}
              </div>
              {/* Back */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl bg-neutral-700 shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
                {renderCardBack()}
              </div>
            </div>
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

          {/* Input area (only when card is not flipped) */}
          {!isFlipped && !isComplete && (
            <div className="flex w-full max-w-sm items-center gap-2">
              {gameMode === "SentenceCompletion" &&
              cardsSentenceCompletion[currentIndex]?.options?.length ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {cardsSentenceCompletion[currentIndex].options!.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => checkAnswer(opt)}
                      className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && userInput.trim()) checkAnswer(userInput);
                    }}
                    placeholder={gameMode === "ImageToWord" ? "Enter the word" : "Type the missing word"}
                    className="flex-1 rounded-lg bg-neutral-800 px-4 py-2 text-sm text-white placeholder-neutral-500 outline-none ring-1 ring-white/10 focus:ring-white/30"
                    autoFocus
                  />
                  <button
                    onClick={() => checkAnswer(userInput)}
                    disabled={!userInput.trim()}
                    className={cn(
                      "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white",
                      userInput.trim() ? "hover:bg-blue-700" : "cursor-not-allowed opacity-50",
                    )}
                  >
                    Check
                  </button>
                </>
              )}
            </div>
          )}

          {/* Next / Finish button */}
          {showNextButton && !isComplete && (
            <button
              onClick={advanceCard}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {currentIndex <
              (gameMode === "ImageToWord" ? cardsImageToWord.length : cardsSentenceCompletion.length) - 1
                ? "Next"
                : "Finish"}
            </button>
          )}
        </>
      ) : (
        <p className="text-neutral-500">Loading game mode...</p>
      )}
    </div>
  );
};
