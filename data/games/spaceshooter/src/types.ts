import { Vector2 } from "@/modules/engine/types";

// ---- Ship ----

export interface Ship {
  id: string;
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  scale: number;
  active: boolean;
  collisionRadius: number;
  health: number;
  maxHealth: number;
  shield: number;
  weapons: WeaponState;
  playerId: string;
  playerName: string;
  score: number;
  lives: number;
  invulnerable: boolean;
  invulnerableUntil: number;
}

export interface WeaponState {
  fireRate: number;
  lastFired: number;
  bulletType: BulletType;
  spreadCount: number;
}

// ---- Bullet ----

export type BulletType = "normal" | "laser" | "missile";

export interface Bullet {
  id: string;
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  active: boolean;
  collisionRadius: number;
  damage: number;
  ownerId: string;
  lifetime: number;
  maxLifetime: number;
  bulletType: BulletType;
}

// ---- Enemy ----

export type EnemyType = "scout" | "fighter" | "bomber" | "boss";

export interface Enemy {
  id: string;
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  scale: number;
  active: boolean;
  collisionRadius: number;
  health: number;
  maxHealth: number;
  enemyType: EnemyType;
  behavior: string;
  scoreValue: number;
  dropChance: number;
  spawnTime: number;
  bossPhase?: number;
  lastShot: number;
  telegraphing: boolean;
  telegraphStart: number;
}

// ---- Power-Up ----

export type PowerUpType = "health" | "shield" | "rapidFire" | "spread" | "missile" | "speedBoost";

export interface PowerUp {
  id: string;
  position: Vector2;
  velocity: Vector2;
  active: boolean;
  collisionRadius: number;
  powerUpType: PowerUpType;
  lifetime: number;
  maxLifetime: number;
}

// ---- Planet (background decoration) ----

export interface Planet {
  name: string;
  radius: number;
  color: string;
  surfaceDetails: PlanetSurfaceType;
  scrollSpeed: number;
  parallaxDepth: number;
  x: number;
  y: number;
}

export type PlanetSurfaceType = "rocky" | "gas-bands" | "ringed" | "ice" | "volcanic";

// ---- Waves ----

export interface WaveEnemySpawn {
  type: EnemyType;
  count: number;
  formation: "line" | "v" | "circle" | "random";
  delay: number;
}

export interface GameWave {
  waveNumber: number;
  enemies: WaveEnemySpawn[];
  delayBetweenSpawns: number;
  isBoss: boolean;
  planetIndex?: number;
}

// ---- Game State ----

export type GamePhase = "MENU" | "PLAYING" | "WAVE_CLEAR" | "BOSS" | "GAME_OVER" | "RESULTS";

export interface ActivePowerUp {
  type: PowerUpType;
  expiresAt: number;
}

// ---- Helpers ----

export function createDefaultWeapon(): WeaponState {
  return { fireRate: 5, lastFired: 0, bulletType: "normal", spreadCount: 1 };
}

export function createShip(id: string, name: string, pos: Vector2): Ship {
  return {
    id,
    position: pos.clone(),
    velocity: Vector2.zero(),
    rotation: -Math.PI / 2,
    scale: 1,
    active: true,
    collisionRadius: 14,
    health: 100,
    maxHealth: 100,
    shield: 0,
    weapons: createDefaultWeapon(),
    playerId: id,
    playerName: name,
    score: 0,
    lives: 3,
    invulnerable: false,
    invulnerableUntil: 0,
  };
}
