"use client";

/**
 * SolarSystemQuiz — end-of-lesson quiz about the solar system.
 * Generates questions from planet data, tracks score, shows celebration.
 */

import React, { useState, useMemo, useCallback } from "react";

// ---- Types ----
interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface QuizState {
  currentQuestion: number;
  score: number;
  answers: (number | null)[];
  feedback: { correct: boolean; correctAnswer: string } | null;
  completed: boolean;
}

interface SolarSystemQuizProps {
  onComplete: (score: number, total: number) => void;
}

// ---- Question Generator ----
function generateQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  // Q1: Closest to the Sun
  questions.push({
    question: "Which planet is closest to the Sun?",
    options: ["Venus", "Mercury", "Earth", "Mars"],
    correctIndex: 1,
  });

  // Q2: Biggest planet
  questions.push({
    question: "Which is the biggest planet in our solar system?",
    options: ["Saturn", "Neptune", "Jupiter", "Uranus"],
    correctIndex: 2,
  });

  // Q3: Red Planet
  questions.push({
    question: "Which planet is known as the Red Planet?",
    options: ["Jupiter", "Venus", "Mars", "Mercury"],
    correctIndex: 2,
  });

  // Q4: Rings
  questions.push({
    question: "Which planet is most famous for its beautiful rings?",
    options: ["Jupiter", "Uranus", "Neptune", "Saturn"],
    correctIndex: 3,
  });

  // Q5: Hottest planet
  questions.push({
    question: "Which planet is the hottest in our solar system?",
    options: ["Mercury", "Venus", "Mars", "Jupiter"],
    correctIndex: 1,
  });

  // Q6: Earth's special feature
  questions.push({
    question: "What makes Earth special compared to other planets?",
    options: [
      "It has the most moons",
      "It is the biggest rocky planet",
      "It has liquid water and life",
      "It is the closest to the Sun",
    ],
    correctIndex: 2,
  });

  // Q7: Ice giant that spins on its side
  questions.push({
    question: "Which planet spins on its side like a rolling ball?",
    options: ["Neptune", "Saturn", "Uranus", "Jupiter"],
    correctIndex: 2,
  });

  // Q8: Fastest winds
  questions.push({
    question: "Which planet has the fastest winds in the solar system?",
    options: ["Jupiter", "Saturn", "Uranus", "Neptune"],
    correctIndex: 3,
  });

  return questions;
}

// ---- Celebration Particles ----
const CelebrationParticles: React.FC = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 1.5 + Math.random() * 2,
      size: 4 + Math.random() * 8,
      color: ["#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#F472B6", "#34D399"][
        Math.floor(Math.random() * 6)
      ],
    }));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-celebration-fall"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes celebration-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-celebration-fall {
          animation: celebration-fall linear forwards;
        }
      `}</style>
    </div>
  );
};

// ---- Main Quiz Component ----
export const SolarSystemQuiz: React.FC<SolarSystemQuizProps> = ({
  onComplete,
}) => {
  const questions = useMemo(() => generateQuestions(), []);

  const [state, setState] = useState<QuizState>({
    currentQuestion: 0,
    score: 0,
    answers: Array(questions.length).fill(null),
    feedback: null,
    completed: false,
  });

  const currentQ = questions[state.currentQuestion];

  const handleAnswer = useCallback(
    (selectedIndex: number) => {
      if (state.feedback) return; // already answered

      const correct = selectedIndex === currentQ.correctIndex;
      const newScore = correct ? state.score + 1 : state.score;
      const newAnswers = [...state.answers];
      newAnswers[state.currentQuestion] = selectedIndex;

      setState((prev) => ({
        ...prev,
        score: newScore,
        answers: newAnswers,
        feedback: {
          correct,
          correctAnswer: currentQ.options[currentQ.correctIndex],
        },
      }));

      // Auto-advance after delay
      setTimeout(() => {
        const nextQ = state.currentQuestion + 1;
        if (nextQ >= questions.length) {
          setState((prev) => ({ ...prev, completed: true, feedback: null }));
          onComplete(newScore, questions.length);
        } else {
          setState((prev) => ({
            ...prev,
            currentQuestion: nextQ,
            feedback: null,
          }));
        }
      }, 1800);
    },
    [state, currentQ, questions.length, onComplete]
  );

  // Completed view
  if (state.completed) {
    const percentage = Math.round((state.score / questions.length) * 100);
    const message =
      percentage >= 80
        ? "Amazing! You are a space expert!"
        : percentage >= 50
          ? "Great job! You know a lot about space!"
          : "Good try! Keep exploring the solar system!";

    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 p-8">
        <CelebrationParticles />
        <div className="relative z-10 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/60 p-8 backdrop-blur-xl">
          <h2 className="text-3xl font-bold text-white">Quiz Complete!</h2>
          <div className="text-6xl font-bold text-yellow-400">
            {state.score}/{questions.length}
          </div>
          <p className="text-center text-lg text-white/80">{message}</p>
          <div className="mt-2 h-3 w-48 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-1000"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Question view
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/60 p-6 backdrop-blur-xl">
        {/* Progress */}
        <div className="mb-4 flex items-center justify-between text-sm text-white/50">
          <span>
            Question {state.currentQuestion + 1} of {questions.length}
          </span>
          <span>Score: {state.score}</span>
        </div>
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{
              width: `${((state.currentQuestion + (state.feedback ? 1 : 0)) / questions.length) * 100}%`,
            }}
          />
        </div>

        {/* Question */}
        <h3 className="mb-6 text-xl font-semibold text-white">{currentQ.question}</h3>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {currentQ.options.map((option, i) => {
            let classes = "rounded-lg px-4 py-3 text-left text-sm text-white transition-all ";
            if (state.feedback) {
              if (i === currentQ.correctIndex) {
                classes += "bg-emerald-500/30 ring-1 ring-emerald-400";
              } else if (i === state.answers[state.currentQuestion] && i !== currentQ.correctIndex) {
                classes += "bg-red-500/30 ring-1 ring-red-400";
              } else {
                classes += "bg-white/5 opacity-50";
              }
            } else {
              classes += "bg-white/10 hover:bg-white/20 cursor-pointer";
            }

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={!!state.feedback}
                className={classes}
              >
                <span className="mr-2 inline-block w-5 text-white/40">
                  {String.fromCharCode(65 + i)}.
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {state.feedback && (
          <p
            className={`mt-4 text-center text-sm font-medium ${
              state.feedback.correct ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {state.feedback.correct
              ? "Correct! Well done!"
              : `The answer is: ${state.feedback.correctAnswer}`}
          </p>
        )}
      </div>
    </div>
  );
};
