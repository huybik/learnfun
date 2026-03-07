import { Vector2 } from "@/modules/engine/types";
import type { GameWave, WaveEnemySpawn, Enemy, EnemyType } from "./types";

/** Generate wave definitions for progressive difficulty. */
export function generateWaves(count: number): GameWave[] {
  const waves: GameWave[] = [];
  for (let i = 1; i <= count; i++) {
    const isBoss = i % 5 === 0;
    const planetIndex = Math.floor((i - 1) / 3) % 8;

    if (isBoss) {
      waves.push({
        waveNumber: i,
        enemies: [{ type: "boss", count: 1, formation: "random", delay: 0 }],
        delayBetweenSpawns: 0,
        isBoss: true,
        planetIndex,
      });
    } else {
      const enemies: WaveEnemySpawn[] = [];
      // Scouts from wave 1
      if (i >= 1) enemies.push({ type: "scout", count: 2 + Math.floor(i * 0.5), formation: pickFormation(i), delay: 0.5 });
      // Fighters from wave 3
      if (i >= 3) enemies.push({ type: "fighter", count: 1 + Math.floor((i - 2) * 0.4), formation: pickFormation(i + 1), delay: 0.8 });
      // Bombers from wave 6
      if (i >= 6) {
        const bomberCount = Math.max(1, Math.floor((i - 4) * 0.3));
        enemies.push({ type: "bomber", count: bomberCount, formation: "random", delay: 1.2 });
      }

      waves.push({
        waveNumber: i,
        enemies,
        delayBetweenSpawns: Math.max(0.3, 1.0 - i * 0.03),
        isBoss: false,
        planetIndex: i % 3 === 0 ? planetIndex : undefined,
      });
    }
  }
  return waves;
}

function pickFormation(seed: number): "line" | "v" | "circle" | "random" {
  const forms: Array<"line" | "v" | "circle" | "random"> = ["line", "v", "circle", "random"];
  return forms[seed % forms.length];
}

/** State for active wave spawning. */
export interface WaveState {
  currentWave: number;
  waves: GameWave[];
  spawnQueue: Array<{ type: EnemyType; position: Vector2; delay: number }>;
  spawnTimer: number;
  waveCleared: boolean;
  waveClearTime: number;
  betweenWaves: boolean;
  announcementTimer: number;
}

export function createWaveState(): WaveState {
  return {
    currentWave: 0,
    waves: generateWaves(30),
    spawnQueue: [],
    spawnTimer: 0,
    waveCleared: false,
    waveClearTime: 0,
    betweenWaves: true,
    announcementTimer: 0,
  };
}

/** Start the next wave — populates the spawn queue. */
export function startNextWave(state: WaveState, canvasW: number, canvasH: number): void {
  state.currentWave++;
  const waveDef = state.waves[state.currentWave - 1];
  if (!waveDef) return;

  state.spawnQueue = [];
  state.spawnTimer = 0;
  state.waveCleared = false;
  state.betweenWaves = false;
  state.announcementTimer = 2; // 2 seconds of announcement

  let totalDelay = 0;
  for (const group of waveDef.enemies) {
    const positions = getFormationPositions(group.formation, group.count, canvasW, canvasH);
    for (let i = 0; i < group.count; i++) {
      state.spawnQueue.push({
        type: group.type,
        position: positions[i] ?? new Vector2(Math.random() * canvasW, -40),
        delay: totalDelay + i * group.delay,
      });
    }
    totalDelay += group.count * group.delay + waveDef.delayBetweenSpawns;
  }
}

function getFormationPositions(formation: string, count: number, w: number, h: number): Vector2[] {
  const margin = 60;
  const positions: Vector2[] = [];

  switch (formation) {
    case "line":
      for (let i = 0; i < count; i++) {
        positions.push(new Vector2(margin + (i / Math.max(1, count - 1)) * (w - margin * 2), -40));
      }
      break;
    case "v":
      for (let i = 0; i < count; i++) {
        const mid = (count - 1) / 2;
        const offset = Math.abs(i - mid) * 40;
        positions.push(new Vector2(margin + (i / Math.max(1, count - 1)) * (w - margin * 2), -40 - offset));
      }
      break;
    case "circle":
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        positions.push(new Vector2(w / 2 + Math.cos(angle) * 150, -40 + Math.sin(angle) * 60 - 60));
      }
      break;
    default: // random
      for (let i = 0; i < count; i++) {
        positions.push(new Vector2(margin + Math.random() * (w - margin * 2), -30 - Math.random() * 80));
      }
  }
  return positions;
}

/** Create an enemy entity from a spawn entry. waveNumber scales boss health. */
export function createEnemy(id: string, type: EnemyType, position: Vector2, time: number, waveNumber = 1): Enemy {
  const configs: Record<EnemyType, { health: number; score: number; drop: number; radius: number }> = {
    scout: { health: 30, score: 100, drop: 0.1, radius: 10 },
    fighter: { health: 60, score: 200, drop: 0.15, radius: 14 },
    bomber: { health: 120, score: 300, drop: 0.25, radius: 20 },
    boss: { health: 500, score: 2000, drop: 1.0, radius: 40 },
  };

  const cfg = { ...configs[type] };
  if (type === "boss") {
    const bossIndex = Math.floor(waveNumber / 5);
    cfg.health = 500 + (bossIndex - 1) * 250;
    cfg.score = 2000 + (bossIndex - 1) * 500;
  }
  return {
    id,
    position: position.clone(),
    velocity: Vector2.zero(),
    rotation: Math.PI / 2, // facing down
    scale: 1,
    active: true,
    collisionRadius: cfg.radius,
    health: cfg.health,
    maxHealth: cfg.health,
    enemyType: type,
    behavior: type,
    scoreValue: cfg.score,
    dropChance: cfg.drop,
    spawnTime: time,
    lastShot: time,
    telegraphing: false,
    telegraphStart: 0,
  };
}
