import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type FeedbackType = "correct" | "incorrect";

interface ScoreBoardProps {
  score: number;
  streak: number;
  feedback: { type: FeedbackType; key: number; points?: number } | null;
}

const FEEDBACK_DISPLAY_MS = 1500;

/**
 * Gamification HUD: shows score, streak, and transient feedback.
 */
export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  score,
  streak,
  feedback,
}) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    if (!feedback) return;
    setFeedbackType(feedback.type);
    setPoints(feedback.points ?? null);
    setShowFeedback(true);

    const timer = setTimeout(() => {
      setShowFeedback(false);
      setPoints(null);
    }, FEEDBACK_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <div className="absolute left-4 top-4 z-50 flex items-center gap-3">
      {/* Score */}
      <div className="flex items-center gap-1.5 rounded-full bg-neutral-800/80 px-3 py-1.5 shadow-lg backdrop-blur">
        <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span className="text-sm font-bold text-white">{score}</span>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-orange-600/20 px-3 py-1.5 shadow-lg backdrop-blur">
          <svg className="h-4 w-4 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
          </svg>
          <span className="text-sm font-bold text-orange-300">{streak}</span>
        </div>
      )}

      {/* Feedback indicator */}
      <div
        className={cn(
          "flex items-center gap-1 transition-all duration-300",
          showFeedback ? "scale-100 opacity-100" : "scale-75 opacity-0",
        )}
      >
        {feedbackType === "correct" && (
          <span className="text-xl text-green-400">&#x2705;</span>
        )}
        {feedbackType === "incorrect" && (
          <span className="text-xl text-red-400">&#x274C;</span>
        )}
        {points !== null && points !== 0 && (
          <span
            className={cn(
              "text-sm font-bold",
              points > 0 ? "text-green-400" : "text-red-400",
            )}
          >
            {points > 0 ? `+${points}` : points}
          </span>
        )}
      </div>
    </div>
  );
};
