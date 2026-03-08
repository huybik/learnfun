"use client";

/**
 * PlanetInfoPanel — glassmorphism overlay panel showing planet information.
 * Slides in from the right when a planet is focused.
 */

import React, { useState, useEffect, useMemo } from "react";
import { PLANET_DATA } from "./planet-data";

// ---- Props ----
interface PlanetInfoPanelProps {
  planetName: string | null;
  onClose: () => void;
  onNavigate: (planetName: string) => void;
}

export const PlanetInfoPanel: React.FC<PlanetInfoPanelProps> = ({
  planetName,
  onClose,
  onNavigate,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [revealedFacts, setRevealedFacts] = useState(0);

  const planet = useMemo(
    () => (planetName ? PLANET_DATA.find((p) => p.name === planetName) : null),
    [planetName]
  );

  // Animate entrance/exit
  useEffect(() => {
    if (planetName) {
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [planetName]);

  // Animate fact reveals
  useEffect(() => {
    if (!planet) {
      setRevealedFacts(0);
      return;
    }
    setRevealedFacts(0);
    const timers: NodeJS.Timeout[] = [];
    planet.funFacts.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealedFacts(i + 1), 400 + i * 300));
    });
    return () => timers.forEach(clearTimeout);
  }, [planet]);

  // Navigation helpers
  const allBodies = PLANET_DATA;
  const currentIndex = planet ? allBodies.findIndex((p) => p.name === planet.name) : -1;
  const prevPlanet = currentIndex > 0 ? allBodies[currentIndex - 1] : null;
  const nextPlanet = currentIndex < allBodies.length - 1 ? allBodies[currentIndex + 1] : null;

  if (!planetName) return null;

  return (
    <div
      className={`absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col transition-transform duration-500 ease-out ${
        isVisible ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col overflow-y-auto rounded-l-2xl border-l border-white/10 bg-black/60 p-6 backdrop-blur-xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white">{planetName}</h2>
            {planet?.moons !== undefined && (
              <p className="mt-1 text-sm text-blue-300/80">
                {planet.moons === 0
                  ? "No moons"
                  : `${planet.moons} moon${planet.moons > 1 ? "s" : ""}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            Back
          </button>
        </div>

        {/* Info mode */}
        {planet && (
            <div className="flex flex-1 flex-col gap-5">
              {/* Description */}
              <p className="text-sm leading-relaxed text-white/85">{planet.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Temperature" value={planet.temperature} />
                <StatCard label="Day Length" value={planet.dayLength} />
                <StatCard label="Year Length" value={planet.yearLength} />
                {planet.moons !== undefined && (
                  <StatCard label="Moons" value={String(planet.moons)} />
                )}
              </div>

              {/* Fun Facts */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-300/80">
                  Fun Facts
                </h3>
                <ul className="flex flex-col gap-2">
                  {planet.funFacts.map((fact, i) => (
                    <li
                      key={i}
                      className={`text-sm text-white/75 transition-all duration-300 ${
                        i < revealedFacts
                          ? "translate-x-0 opacity-100"
                          : "translate-x-4 opacity-0"
                      }`}
                    >
                      <span className="mr-2 text-yellow-400">*</span>
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
        )}

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <button
              onClick={() => prevPlanet && onNavigate(prevPlanet.name)}
              disabled={!prevPlanet}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:hover:bg-white/10"
            >
              {prevPlanet ? `< ${prevPlanet.name}` : "< Prev"}
            </button>
            <span className="text-xs text-white/40">
              {currentIndex + 1} / {allBodies.length}
            </span>
            <button
              onClick={() => nextPlanet && onNavigate(nextPlanet.name)}
              disabled={!nextPlanet}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:hover:bg-white/10"
            >
              {nextPlanet ? `${nextPlanet.name} >` : "Next >"}
            </button>
          </div>
      </div>
    </div>
  );
};

// ---- Stat Card ----
const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-white/5 px-3 py-2">
    <p className="text-xs text-white/50">{label}</p>
    <p className="text-sm font-medium text-white/90">{value}</p>
  </div>
);
