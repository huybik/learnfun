import { Vector2 } from "@/modules/engine/types";
import type { Enemy, BulletType } from "./types";

type SpawnBulletFn = (pos: Vector2, vel: Vector2, damage: number, ownerId: string, bulletType: BulletType) => void;

/** Scout: fast sine-wave movement, occasional shots. */
export function scoutBehavior(enemy: Enemy, playerPos: Vector2, time: number, dt: number, spawnBullet: SpawnBulletFn): void {
  const age = time - enemy.spawnTime;
  // Sine-wave horizontal drift
  enemy.velocity.x = Math.sin(age * 3) * 120;
  // Steady downward movement
  enemy.velocity.y = 100;

  // Face movement direction
  enemy.rotation = Math.atan2(enemy.velocity.y, enemy.velocity.x);

  // Shoot every ~2 seconds
  if (time - enemy.lastShot > 2) {
    startTelegraph(enemy, time);
  }
  if (enemy.telegraphing && time - enemy.telegraphStart > 0.3) {
    enemy.telegraphing = false;
    enemy.lastShot = time;
    const dir = Vector2.sub(playerPos, enemy.position);
    const mag = dir.magnitude();
    if (mag > 0) dir.scale(1 / mag);
    spawnBullet(enemy.position.clone(), Vector2.scale(dir, 250), 10, enemy.id, "normal");
  }
}

/** Fighter: heads toward player, shoots frequently. */
export function fighterBehavior(enemy: Enemy, playerPos: Vector2, time: number, dt: number, spawnBullet: SpawnBulletFn): void {
  const dir = Vector2.sub(playerPos, enemy.position);
  const dist = dir.magnitude();
  if (dist > 0) dir.scale(1 / dist);

  // Move toward player but maintain some distance
  if (dist > 200) {
    enemy.velocity.x = dir.x * 140;
    enemy.velocity.y = dir.y * 140;
  } else {
    // Orbit when close
    const age = time - enemy.spawnTime;
    enemy.velocity.x = dir.x * 40 + Math.cos(age * 2) * 100;
    enemy.velocity.y = dir.y * 40 + Math.sin(age * 2) * 100;
  }

  enemy.rotation = Math.atan2(dir.y, dir.x);

  // Shoot every ~1.2 seconds
  if (time - enemy.lastShot > 1.2) {
    startTelegraph(enemy, time);
  }
  if (enemy.telegraphing && time - enemy.telegraphStart > 0.25) {
    enemy.telegraphing = false;
    enemy.lastShot = time;
    spawnBullet(enemy.position.clone(), Vector2.scale(dir, 300), 15, enemy.id, "normal");
  }
}

/** Bomber: slow, tanky, large slow projectiles. */
export function bomberBehavior(enemy: Enemy, playerPos: Vector2, time: number, dt: number, spawnBullet: SpawnBulletFn): void {
  // Slow drift downward
  enemy.velocity.x = Math.sin(time * 0.5) * 30;
  enemy.velocity.y = 50;

  const dir = Vector2.sub(playerPos, enemy.position);
  const dist = dir.magnitude();
  if (dist > 0) dir.scale(1 / dist);
  enemy.rotation = Math.atan2(dir.y, dir.x);

  // Shoot large projectiles every ~2.5 seconds
  if (time - enemy.lastShot > 2.5) {
    startTelegraph(enemy, time);
  }
  if (enemy.telegraphing && time - enemy.telegraphStart > 0.5) {
    enemy.telegraphing = false;
    enemy.lastShot = time;
    spawnBullet(enemy.position.clone(), Vector2.scale(dir, 150), 25, enemy.id, "laser");
  }
}

/** Boss: multiple phases, pattern-based attacks, spawns minions. */
export function bossBehavior(enemy: Enemy, playerPos: Vector2, time: number, dt: number, spawnBullet: SpawnBulletFn): void {
  const phase = enemy.bossPhase ?? 0;
  const healthPct = enemy.health / enemy.maxHealth;

  // Advance phase based on health
  if (healthPct < 0.33 && phase < 2) enemy.bossPhase = 2;
  else if (healthPct < 0.66 && phase < 1) enemy.bossPhase = 1;

  const currentPhase = enemy.bossPhase ?? 0;
  const age = time - enemy.spawnTime;

  // Movement: slow figure-8 pattern
  const speed = 60 + currentPhase * 20;
  enemy.velocity.x = Math.sin(age * 0.8) * speed;
  enemy.velocity.y = Math.cos(age * 0.5) * speed * 0.5 + 20;

  const dir = Vector2.sub(playerPos, enemy.position);
  const dist = dir.magnitude();
  if (dist > 0) dir.scale(1 / dist);
  enemy.rotation = Math.atan2(dir.y, dir.x);

  // Attack patterns based on phase
  const shotInterval = currentPhase === 0 ? 1.5 : currentPhase === 1 ? 1.0 : 0.7;

  if (time - enemy.lastShot > shotInterval) {
    startTelegraph(enemy, time);
  }
  if (enemy.telegraphing && time - enemy.telegraphStart > 0.3) {
    enemy.telegraphing = false;
    enemy.lastShot = time;

    if (currentPhase === 0) {
      // Phase 0: single aimed shot
      spawnBullet(enemy.position.clone(), Vector2.scale(dir, 200), 20, enemy.id, "normal");
    } else if (currentPhase === 1) {
      // Phase 1: 3-way spread
      for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(dir.y, dir.x) + i * 0.3;
        spawnBullet(enemy.position.clone(), Vector2.fromAngle(angle, 220), 15, enemy.id, "normal");
      }
    } else {
      // Phase 2: circular burst
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        spawnBullet(enemy.position.clone(), Vector2.fromAngle(angle, 180), 12, enemy.id, "laser");
      }
    }
  }
}

function startTelegraph(enemy: Enemy, time: number): void {
  if (!enemy.telegraphing) {
    enemy.telegraphing = true;
    enemy.telegraphStart = time;
  }
}

/** Dispatch to the correct behavior function. */
export function updateEnemyBehavior(
  enemy: Enemy,
  playerPos: Vector2,
  time: number,
  dt: number,
  spawnBullet: SpawnBulletFn,
): void {
  switch (enemy.behavior) {
    case "scout": scoutBehavior(enemy, playerPos, time, dt, spawnBullet); break;
    case "fighter": fighterBehavior(enemy, playerPos, time, dt, spawnBullet); break;
    case "bomber": bomberBehavior(enemy, playerPos, time, dt, spawnBullet); break;
    case "boss": bossBehavior(enemy, playerPos, time, dt, spawnBullet); break;
  }
}
