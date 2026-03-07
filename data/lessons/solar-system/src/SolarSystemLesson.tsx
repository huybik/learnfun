"use client";

/**
 * SolarSystemLesson — main lesson orchestrator.
 * Phases: INTRO -> EXPLORE -> QUIZ -> SUMMARY
 * Integrates with GameContext for AI teacher communication.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { SolarSystemScene } from "./SolarSystemScene";
import { PlanetInfoPanel } from "./PlanetInfoPanel";
import { SolarSystemQuiz } from "./SolarSystemQuiz";
import { PLANET_DATA } from "./planet-data";
import { useGameContext } from "@/modules/display/hooks/useGameState";

// ---- Types ----
type LessonPhase = "INTRO" | "EXPLORE" | "QUIZ" | "SUMMARY";

const PLANET_ORDER = PLANET_DATA.map((p) => p.name);
const AUTO_ADVANCE_DELAY = 12000; // ms per planet in auto-advance mode

// ---- Main Component ----
export const SolarSystemLesson: React.FC = () => {
  const { updateGameStateForAI, endGame } = useGameContext();

  const [phase, setPhase] = useState<LessonPhase>("INTRO");
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const [introOpacity, setIntroOpacity] = useState(1);
  const [exploredPlanets, setExploredPlanets] = useState<Set<string>>(new Set());
  const [quizScore, setQuizScore] = useState<{ score: number; total: number } | null>(null);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const [autoMode, setAutoMode] = useState(false);

  // ---- Phase transitions ----
  const startExplore = useCallback(() => {
    setIntroOpacity(0);
    setTimeout(() => {
      setPhase("EXPLORE");
      setSelectedPlanet("Sun");
      updateGameStateForAI({
        status: "exploring",
        phase: "EXPLORE",
        message: "Student is now exploring the solar system. Starting with the Sun.",
        currentPlanet: "Sun",
      });
    }, 600);
  }, [updateGameStateForAI]);

  const startQuiz = useCallback(() => {
    setSelectedPlanet(null);
    setTimeout(() => {
      setPhase("QUIZ");
      updateGameStateForAI({
        status: "quiz",
        phase: "QUIZ",
        message: "Student is now taking the solar system quiz.",
      });
    }, 500);
  }, [updateGameStateForAI]);

  // ---- Intro auto-start ----
  useEffect(() => {
    if (phase === "INTRO") {
      updateGameStateForAI({
        status: "intro",
        phase: "INTRO",
        message: "Solar System lesson started. Showing intro.",
      });
      const timer = setTimeout(startExplore, 4000);
      return () => clearTimeout(timer);
    }
  }, [phase, startExplore, updateGameStateForAI]);

  // ---- Planet selection ----
  const handleSelectPlanet = useCallback(
    (name: string | null) => {
      if (phase !== "EXPLORE") return;
      setSelectedPlanet(name);
      if (name) {
        setExploredPlanets((prev) => {
          const next = new Set(prev).add(name);
          updateGameStateForAI({
            status: "exploring",
            phase: "EXPLORE",
            currentPlanet: name,
            message: `Student selected ${name}.`,
            exploredCount: next.size,
            totalPlanets: PLANET_DATA.length,
          });
          return next;
        });
      }
    },
    [phase, updateGameStateForAI]
  );

  const handleNavigate = useCallback(
    (planetName: string) => {
      handleSelectPlanet(planetName);
    },
    [handleSelectPlanet]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedPlanet(null);
  }, []);

  // ---- Auto-advance through planets ----
  useEffect(() => {
    if (!autoMode || phase !== "EXPLORE") return;

    autoAdvanceTimer.current = setTimeout(() => {
      const currentIndex = selectedPlanet
        ? PLANET_ORDER.indexOf(selectedPlanet)
        : -1;
      const nextIndex = currentIndex + 1;
      if (nextIndex < PLANET_ORDER.length) {
        handleSelectPlanet(PLANET_ORDER[nextIndex]);
      } else {
        setAutoMode(false);
        startQuiz();
      }
    }, AUTO_ADVANCE_DELAY);

    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [autoMode, selectedPlanet, phase, handleSelectPlanet, startQuiz]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phase === "INTRO") {
        if (e.key === "Enter" || e.key === " ") startExplore();
        return;
      }
      if (phase !== "EXPLORE") return;

      if (e.key === "Escape") {
        setSelectedPlanet(null);
        return;
      }

      const currentIndex = selectedPlanet
        ? PLANET_ORDER.indexOf(selectedPlanet)
        : -1;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentIndex + 1, PLANET_ORDER.length - 1);
        handleSelectPlanet(PLANET_ORDER[next]);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(currentIndex - 1, 0);
        handleSelectPlanet(PLANET_ORDER[prev]);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, selectedPlanet, handleSelectPlanet, startExplore]);

  // ---- Touch/swipe ----
  const touchStartX = useRef(0);
  useEffect(() => {
    if (phase !== "EXPLORE") return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) < 50) return;

      const currentIndex = selectedPlanet
        ? PLANET_ORDER.indexOf(selectedPlanet)
        : -1;

      if (dx < 0) {
        // Swipe left = next
        const next = Math.min(currentIndex + 1, PLANET_ORDER.length - 1);
        handleSelectPlanet(PLANET_ORDER[next]);
      } else {
        // Swipe right = prev
        const prev = Math.max(currentIndex - 1, 0);
        handleSelectPlanet(PLANET_ORDER[prev]);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [phase, selectedPlanet, handleSelectPlanet]);

  // ---- Quiz completion ----
  const handleQuizComplete = useCallback(
    (score: number, total: number) => {
      setQuizScore({ score, total });
      setPhase("SUMMARY");
      updateGameStateForAI({
        status: "completed",
        phase: "SUMMARY",
        message: `Quiz completed! Score: ${score}/${total}`,
        quizScore: score,
        quizTotal: total,
      });
    },
    [updateGameStateForAI]
  );

  // ---- Finish lesson ----
  const handleFinish = useCallback(() => {
    endGame({
      outcome: "completed",
      finalScore: quizScore?.score ?? 0,
      reason: `Solar System lesson completed. Quiz: ${quizScore?.score}/${quizScore?.total}`,
    });
  }, [endGame, quizScore]);

  // ---- Check if all planets explored ----
  const allExplored = exploredPlanets.size >= PLANET_DATA.length;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* 3D Scene — always rendered underneath */}
      {(phase === "INTRO" || phase === "EXPLORE") && (
        <div className="absolute inset-0">
          <SolarSystemScene
            selectedPlanet={phase === "EXPLORE" ? selectedPlanet : null}
            onSelectPlanet={handleSelectPlanet}
          />
        </div>
      )}

      {/* INTRO overlay */}
      {phase === "INTRO" && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center transition-opacity duration-500"
          style={{ opacity: introOpacity }}
        >
          <div className="flex flex-col items-center gap-4">
            <h1 className="animate-fade-in text-5xl font-bold tracking-tight text-white drop-shadow-lg md:text-6xl">
              Welcome to Our
            </h1>
            <h1 className="animate-fade-in-delay text-5xl font-bold tracking-tight text-blue-400 drop-shadow-lg md:text-6xl">
              Solar System!
            </h1>
            <p className="mt-4 animate-fade-in-delay-2 text-lg text-white/60">
              Get ready to explore the planets...
            </p>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
            .animate-fade-in-delay { animation: fadeIn 0.8s ease-out 0.3s forwards; opacity: 0; }
            .animate-fade-in-delay-2 { animation: fadeIn 0.8s ease-out 0.8s forwards; opacity: 0; }
          `}</style>
        </div>
      )}

      {/* EXPLORE controls */}
      {phase === "EXPLORE" && (
        <>
          {/* Info Panel */}
          <PlanetInfoPanel
            planetName={selectedPlanet}
            onClose={handleClosePanel}
            onNavigate={handleNavigate}
          />

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoMode(!autoMode)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  autoMode
                    ? "bg-blue-500/30 text-blue-300 ring-1 ring-blue-400/50"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                {autoMode ? "Auto Tour On" : "Auto Tour"}
              </button>
              <span className="text-xs text-white/30">
                {exploredPlanets.size}/{PLANET_DATA.length} explored
              </span>
            </div>

            {allExplored && (
              <button
                onClick={startQuiz}
                className="rounded-lg bg-emerald-500/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                Take the Quiz!
              </button>
            )}

            {!allExplored && (
              <button
                onClick={startQuiz}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/50 transition-colors hover:bg-white/20 hover:text-white/70"
              >
                Skip to Quiz
              </button>
            )}
          </div>

          {/* Keyboard hint */}
          <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 pb-4">
            <p className="text-xs text-white/20">
              Arrow keys to navigate | ESC to overview
            </p>
          </div>
        </>
      )}

      {/* QUIZ phase */}
      {phase === "QUIZ" && (
        <div className="absolute inset-0 z-10 bg-black/90">
          <SolarSystemQuiz onComplete={handleQuizComplete} />
        </div>
      )}

      {/* SUMMARY phase */}
      {phase === "SUMMARY" && quizScore && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-black/90 p-8">
          <h2 className="text-4xl font-bold text-white">Lesson Complete!</h2>
          <p className="text-xl text-white/70">
            You explored {exploredPlanets.size} of {PLANET_DATA.length} objects in our solar
            system.
          </p>
          <div className="flex items-center gap-2 text-2xl">
            <span className="text-white/60">Quiz Score:</span>
            <span className="font-bold text-yellow-400">
              {quizScore.score}/{quizScore.total}
            </span>
          </div>
          <button
            onClick={handleFinish}
            className="mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 px-8 py-3 text-lg font-semibold text-white transition-transform hover:scale-105"
          >
            Finish Lesson
          </button>
        </div>
      )}
    </div>
  );
};
