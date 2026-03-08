import { Vector2 } from "@/modules/engine/types";
import type { PowerUp, PowerUpType, Ship, ActivePowerUp } from "./types";

const POWER_UP_TYPES: PowerUpType[] = ["health", "shield", "rapidFire", "spread", "missile", "speedBoost"];
const POWER_UP_DURATION: Record<PowerUpType, number> = {
  health: 0,       // instant
  shield: 8,
  rapidFire: 10,
  spread: 10,
  missile: 10,
  speedBoost: 8,
};

/** Randomly pick a power-up type. */
export function randomPowerUpType(): PowerUpType {
  return POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
}

/** Create a power-up entity at given position. */
export function createPowerUp(id: string, type: PowerUpType, position: Vector2): PowerUp {
  return {
    id,
    position: position.clone(),
    velocity: new Vector2(0, 30), // slow drift down
    active: true,
    collisionRadius: 20, // generous hitbox for kids
    powerUpType: type,
    lifetime: 12,
    maxLifetime: 12,
  };
}

/** Apply a power-up to the player ship. Returns updated active power-ups list. */
export function applyPowerUp(
  ship: Ship,
  type: PowerUpType,
  time: number,
  activePowerUps: ActivePowerUp[],
): ActivePowerUp[] {
  const newActives = [...activePowerUps];

  switch (type) {
    case "health":
      ship.health = Math.min(ship.maxHealth, ship.health + 40);
      break;
    case "shield":
      ship.shield = 1;
      addOrRefresh(newActives, type, time + POWER_UP_DURATION[type]);
      break;
    case "rapidFire":
      ship.weapons.fireRate = 12;
      addOrRefresh(newActives, type, time + POWER_UP_DURATION[type]);
      break;
    case "spread":
      ship.weapons.spreadCount = 3;
      addOrRefresh(newActives, type, time + POWER_UP_DURATION[type]);
      break;
    case "missile":
      ship.weapons.bulletType = "missile";
      addOrRefresh(newActives, type, time + POWER_UP_DURATION[type]);
      break;
    case "speedBoost":
      addOrRefresh(newActives, type, time + POWER_UP_DURATION[type]);
      break;
  }

  return newActives;
}

function addOrRefresh(list: ActivePowerUp[], type: PowerUpType, expiresAt: number): void {
  const existing = list.find((p) => p.type === type);
  if (existing) {
    existing.expiresAt = expiresAt;
  } else {
    list.push({ type, expiresAt });
  }
}

/** Check and expire power-ups, resetting ship stats. */
export function tickPowerUps(ship: Ship, activePowerUps: ActivePowerUp[], time: number): ActivePowerUp[] {
  const remaining: ActivePowerUp[] = [];
  for (const pu of activePowerUps) {
    if (time >= pu.expiresAt) {
      // Expire
      switch (pu.type) {
        case "shield": ship.shield = 0; break;
        case "rapidFire": ship.weapons.fireRate = 5; break;
        case "spread": ship.weapons.spreadCount = 1; break;
        case "missile": ship.weapons.bulletType = "normal"; break;
        case "speedBoost": break; // speed is checked directly
      }
    } else {
      remaining.push(pu);
    }
  }
  return remaining;
}

/** Check if a specific power-up is currently active. */
export function isPowerUpActive(activePowerUps: ActivePowerUp[], type: PowerUpType): boolean {
  return activePowerUps.some((p) => p.type === type);
}
