import React, { useState, useEffect } from "react";
import { MdStar, MdLocalFireDepartment, MdCheckCircle, MdCancel } from "react-icons/md";
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
        <MdStar className="text-yellow-400" size={18} />
        <span className="text-sm font-bold text-white">{score}</span>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-orange-600/20 px-3 py-1.5 shadow-lg backdrop-blur">
          <MdLocalFireDepartment className="text-orange-400" size={18} />
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
          <MdCheckCircle className="text-green-400" size={22} />
        )}
        {feedbackType === "incorrect" && (
          <MdCancel className="text-red-400" size={22} />
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
