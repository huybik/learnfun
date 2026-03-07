"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { Vector2 } from "@/modules/engine/types";
import { useGameContext } from "@/modules/display/hooks/useGameState";
import type { Ship, Bullet, Enemy, PowerUp, Planet, ActivePowerUp, GamePhase, BulletType } from "./types";
import { createShip, createDefaultWeapon } from "./types";
import { initPlanets, renderPlanets } from "./planet-backgrounds";
import { drawPlayerShip, drawEnemy, drawBullet, drawPowerUp, drawDeathExplosion, drawDamageFlash } from "./ship-renderer";
import { updateEnemyBehavior } from "./enemy-behaviors";
import { createWaveState, startNextWave, createEnemy, type WaveState } from "./wave-system";
import { createPowerUp, randomPowerUpType, applyPowerUp, tickPowerUps, isPowerUpActive } from "./power-up-system";

// ---- Constants ----
const PLAYER_SPEED = 280;
const PLAYER_SPEED_BOOSTED = 420;
const BULLET_SPEED = 500;
const WORLD_PADDING = 40;

interface StarBg { x: number; y: number; size: number; brightness: number; twinkleSpeed: number; }

interface Explosion { x: number; y: number; startTime: number; duration: number; }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; }

// ---- Main Component ----

export const SpaceShooterGame: React.FC = () => {
  const { updateGameStateForAI, endGame } = useGameContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());

  // Game state refs (mutable for game loop perf)
  const shipRef = useRef<Ship | null>(null);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const starsRef = useRef<StarBg[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const waveRef = useRef<WaveState>(createWaveState());
  const activePURef = useRef<ActivePowerUp[]>([]);
  const nextIdRef = useRef(0);
  const timeRef = useRef(0);
  const damageFlashRef = useRef(0);
  const cameraRef = useRef({ x: 0, y: 0, shakeX: 0, shakeY: 0, shakeTimer: 0, shakeDuration: 0, shakeIntensity: 0 });

  // React state for HUD
  const [gamePhase, setGamePhase] = useState<GamePhase>("MENU");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [health, setHealth] = useState(100);
  const [maxHealth] = useState(100);
  const [wave, setWave] = useState(0);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [announcement, setAnnouncement] = useState<string>("");
  const [enemiesDestroyed, setEnemiesDestroyed] = useState(0);
  const [bossHealth, setBossHealth] = useState<number | null>(null);
  const [bossMaxHealth, setBossMaxHealth] = useState<number | null>(null);

  const phaseRef = useRef<GamePhase>("MENU");
  const scoreRef = useRef(0);
  const enemiesDestroyedRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const genId = useCallback((prefix: string) => `${prefix}_${nextIdRef.current++}`, []);

  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  // ---- Helpers ----
  const shakeCamera = useCallback((intensity: number, duration: number) => {
    const cam = cameraRef.current;
    cam.shakeIntensity = intensity;
    cam.shakeDuration = duration;
    cam.shakeTimer = 0;
  }, []);

  const emitParticles = useCallback((x: number, y: number, count: number, speed: number, colors: string[], life = 0.4) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * s, vy: Math.sin(angle) * s,
        life, maxLife: life,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }, []);

  const spawnBullet = useCallback((pos: Vector2, vel: Vector2, damage: number, ownerId: string, bulletType: BulletType) => {
    bulletsRef.current.push({
      id: genId("b"),
      position: pos,
      velocity: vel,
      rotation: Math.atan2(vel.y, vel.x),
      active: true,
      collisionRadius: bulletType === "laser" ? 6 : 3,
      damage,
      ownerId,
      lifetime: 0,
      maxLifetime: 3,
      bulletType,
    });
  }, [genId]);

  // ---- Init / Resize ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    const obs = new ResizeObserver(handleResize);
    obs.observe(container);

    // Init starfield
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const stars: StarBg[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.5,
        twinkleSpeed: Math.random() * 3 + 1,
      });
    }
    starsRef.current = stars;

    return () => { window.removeEventListener("resize", handleResize); obs.disconnect(); };
  }, []);

  // ---- Input ----
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { keysRef.current.add(e.code); };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.code); };
    const onBlur = () => { keysRef.current.clear(); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("blur", onBlur); };
  }, []);

  // ---- Start Game ----
  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    // Clear any pending timers from previous game
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];

    const ship = createShip("player", "Player", new Vector2(w / 2, h * 0.8));
    shipRef.current = ship;
    bulletsRef.current = [];
    enemiesRef.current = [];
    powerUpsRef.current = [];
    explosionsRef.current = [];
    particlesRef.current = [];
    activePURef.current = [];
    waveRef.current = createWaveState();
    planetsRef.current = initPlanets(w, h);
    nextIdRef.current = 0;
    timeRef.current = 0;
    damageFlashRef.current = 0;
    scoreRef.current = 0;
    enemiesDestroyedRef.current = 0;
    cameraRef.current = { x: 0, y: 0, shakeX: 0, shakeY: 0, shakeTimer: 0, shakeDuration: 0, shakeIntensity: 0 };

    setScore(0);
    setLives(3);
    setHealth(100);
    setWave(0);
    setActivePowerUps([]);
    setAnnouncement("");
    setEnemiesDestroyed(0);
    setBossHealth(null);
    setBossMaxHealth(null);

    phaseRef.current = "PLAYING";
    setGamePhase("PLAYING");

    updateGameStateForAI({ status: "playing", score: 0, wave: 1, lives: 3 });
  }, [updateGameStateForAI]);

  // ---- Player Death (defined before game loop to avoid stale closure) ----
  const handlePlayerDeathRef = useRef<(ship: Ship, time: number) => void>(() => {});
  handlePlayerDeathRef.current = (ship: Ship, time: number) => {
    ship.lives--;
    setLives(ship.lives);
    emitParticles(ship.position.x, ship.position.y, 40, 250, ["#00ccff", "#0088ff", "#fff", "#ffaa00"], 0.8);
    explosionsRef.current.push({ x: ship.position.x, y: ship.position.y, startTime: time, duration: 0.7 });
    shakeCamera(12, 0.4);

    if (ship.lives <= 0) {
      ship.active = false;
      phaseRef.current = "GAME_OVER";
      setGamePhase("GAME_OVER");
      setAnnouncement("GAME OVER");
      updateGameStateForAI({ status: "game_over", finalScore: scoreRef.current, wavesReached: waveRef.current.currentWave, enemiesDestroyed: enemiesDestroyedRef.current });

      safeTimeout(() => {
        phaseRef.current = "RESULTS";
        setGamePhase("RESULTS");
        endGame({ outcome: "completed", finalScore: scoreRef.current });
      }, 3000);
    } else {
      // Respawn with invulnerability
      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const rw = canvas ? canvas.width / dpr : 800;
      const rh = canvas ? canvas.height / dpr : 600;
      ship.position.set(rw / 2, rh * 0.8);
      ship.health = ship.maxHealth;
      ship.shield = 0;
      ship.invulnerable = true;
      ship.invulnerableUntil = time + 3;
      ship.weapons = createDefaultWeapon();
      activePURef.current = [];
      setActivePowerUps([]);
      setHealth(ship.maxHealth);
    }
  };

  // ---- Game Loop ----
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      animRef.current = requestAnimationFrame(loop);
      const dtMs = Math.min(now - lastTime, 50);
      const dt = dtMs / 1000;
      lastTime = now;
      timeRef.current += dt;
      const time = timeRef.current;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Clear
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, w, h);

      const phase = phaseRef.current;

      if (phase === "MENU") {
        renderMenu(ctx, w, h, time);
        ctx.restore();
        return;
      }

      if (phase === "RESULTS") {
        renderResults(ctx, w, h);
        ctx.restore();
        return;
      }

      const ship = shipRef.current;
      if (!ship) { ctx.restore(); return; }
      const bullets = bulletsRef.current;
      const enemies = enemiesRef.current;
      const powerups = powerUpsRef.current;
      const waveState = waveRef.current;
      const cam = cameraRef.current;

      // Camera shake (runs during GAME_OVER too for death effect)
      if (cam.shakeTimer < cam.shakeDuration) {
        cam.shakeTimer += dt;
        const t = 1 - cam.shakeTimer / cam.shakeDuration;
        cam.shakeX = (Math.random() - 0.5) * 2 * cam.shakeIntensity * t;
        cam.shakeY = (Math.random() - 0.5) * 2 * cam.shakeIntensity * t;
      } else {
        cam.shakeX = 0;
        cam.shakeY = 0;
      }

      // Damage flash timer
      if (damageFlashRef.current > 0) damageFlashRef.current -= dt * 3;

      // Update particles (runs during GAME_OVER too for death explosion)
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }

      // ---- UPDATE ----
      if (phase === "PLAYING" || phase === "WAVE_CLEAR" || phase === "BOSS") {

        // Player input
        const keys = keysRef.current;
        let mx = 0, my = 0;
        if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
        if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
        const moveLen = Math.sqrt(mx * mx + my * my);
        if (moveLen > 0) { mx /= moveLen; my /= moveLen; }

        const speed = isPowerUpActive(activePURef.current, "speedBoost") ? PLAYER_SPEED_BOOSTED : PLAYER_SPEED;
        ship.velocity.set(mx * speed, my * speed);
        ship.position.x += ship.velocity.x * dt;
        ship.position.y += ship.velocity.y * dt;

        // Clamp to screen
        ship.position.x = Math.max(WORLD_PADDING, Math.min(w - WORLD_PADDING, ship.position.x));
        ship.position.y = Math.max(WORLD_PADDING, Math.min(h - WORLD_PADDING, ship.position.y));

        // Point ship in movement direction (or default up)
        if (moveLen > 0) {
          ship.rotation = Math.atan2(my, mx);
        } else {
          ship.rotation = -Math.PI / 2;
        }

        // Invulnerability timer
        if (ship.invulnerable && time >= ship.invulnerableUntil) {
          ship.invulnerable = false;
        }

        // Auto-shoot
        if (ship.active) {
          const interval = 1 / ship.weapons.fireRate;
          if (time - ship.weapons.lastFired >= interval) {
            ship.weapons.lastFired = time;
            const baseAngle = -Math.PI / 2; // shoot upward
            if (ship.weapons.spreadCount >= 3) {
              for (let i = -1; i <= 1; i++) {
                const a = baseAngle + i * 0.2;
                spawnBullet(ship.position.clone(), Vector2.fromAngle(a, BULLET_SPEED), 20, "player", ship.weapons.bulletType);
              }
            } else {
              spawnBullet(ship.position.clone(), Vector2.fromAngle(baseAngle, BULLET_SPEED), 20, "player", ship.weapons.bulletType);
            }
          }
        }

        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.position.x += b.velocity.x * dt;
          b.position.y += b.velocity.y * dt;
          b.lifetime += dt;
          if (b.lifetime > b.maxLifetime || b.position.x < -50 || b.position.x > w + 50 || b.position.y < -50 || b.position.y > h + 50) {
            b.active = false;
          }
        }
        bulletsRef.current = bullets.filter((b) => b.active);

        // Update enemies
        for (const enemy of enemies) {
          updateEnemyBehavior(enemy, ship.position, time, dt, spawnBullet);
          enemy.position.x += enemy.velocity.x * dt;
          enemy.position.y += enemy.velocity.y * dt;
          // Remove if too far off screen
          if (enemy.position.y > h + 100 || enemy.position.x < -200 || enemy.position.x > w + 200) {
            enemy.active = false;
          }
        }
        enemiesRef.current = enemies.filter((e) => e.active);

        // Update power-ups
        for (const pu of powerups) {
          pu.position.x += pu.velocity.x * dt;
          pu.position.y += pu.velocity.y * dt;
          pu.lifetime -= dt;
          if (pu.lifetime <= 0 || pu.position.y > h + 50) pu.active = false;
        }
        powerUpsRef.current = powerups.filter((p) => p.active);

        // Tick active power-up durations
        const prevCount = activePURef.current.length;
        activePURef.current = tickPowerUps(ship, activePURef.current, time);
        if (activePURef.current.length !== prevCount) {
          setActivePowerUps([...activePURef.current]);
        }

        // ---- COLLISIONS ----
        // Player bullets vs enemies
        for (const b of bulletsRef.current) {
          if (b.ownerId !== "player") continue;
          for (const enemy of enemiesRef.current) {
            if (!enemy.active || !b.active) continue;
            if (Vector2.distance(b.position, enemy.position) < b.collisionRadius + enemy.collisionRadius) {
              b.active = false;
              enemy.health -= b.damage;
              emitParticles(b.position.x, b.position.y, 5, 100, ["#ffaa00", "#ff6600", "#fff"]);
              if (enemy.health <= 0) {
                enemy.active = false;
                scoreRef.current += enemy.scoreValue;
                setScore(scoreRef.current);
                enemiesDestroyedRef.current++;
                setEnemiesDestroyed(enemiesDestroyedRef.current);
                emitParticles(enemy.position.x, enemy.position.y, 25, 200, ["#ff4400", "#ffaa00", "#ff6622", "#fff"], 0.6);
                explosionsRef.current.push({ x: enemy.position.x, y: enemy.position.y, startTime: time, duration: 0.5 });
                shakeCamera(4, 0.2);
                // Power-up drop
                if (Math.random() < enemy.dropChance) {
                  const puType = randomPowerUpType();
                  powerUpsRef.current.push(createPowerUp(genId("pu"), puType, enemy.position));
                }
              }
            }
          }
        }

        // Enemy bullets vs player
        if (ship.active && !ship.invulnerable) {
          for (const b of bulletsRef.current) {
            if (b.ownerId === "player" || !b.active) continue;
            if (Vector2.distance(b.position, ship.position) < b.collisionRadius + ship.collisionRadius) {
              b.active = false;
              if (ship.shield > 0) {
                ship.shield = 0;
                activePURef.current = activePURef.current.filter((p) => p.type !== "shield");
                emitParticles(ship.position.x, ship.position.y, 10, 120, ["#4488ff", "#88ccff"]);
              } else {
                ship.health -= b.damage;
                damageFlashRef.current = 1;
                shakeCamera(6, 0.15);
                emitParticles(ship.position.x, ship.position.y, 8, 80, ["#ff3333", "#ffaa00"]);
                setHealth(Math.max(0, ship.health));
                if (ship.health <= 0) {
                  handlePlayerDeathRef.current(ship, time);
                }
              }
            }
          }
        }

        // Enemy collision with player
        if (ship.active && !ship.invulnerable) {
          for (const enemy of enemiesRef.current) {
            if (!enemy.active) continue;
            if (Vector2.distance(enemy.position, ship.position) < enemy.collisionRadius + ship.collisionRadius) {
              if (ship.shield > 0) {
                ship.shield = 0;
                activePURef.current = activePURef.current.filter((p) => p.type !== "shield");
                enemy.health -= 50;
                emitParticles(ship.position.x, ship.position.y, 10, 120, ["#4488ff", "#88ccff"]);
                if (enemy.health <= 0) {
                  enemy.active = false;
                  scoreRef.current += enemy.scoreValue;
                  setScore(scoreRef.current);
                  enemiesDestroyedRef.current++;
                  setEnemiesDestroyed(enemiesDestroyedRef.current);
                }
              } else {
                ship.health -= 30;
                enemy.health -= 50;
                damageFlashRef.current = 1;
                shakeCamera(8, 0.2);
                emitParticles(ship.position.x, ship.position.y, 12, 100, ["#ff3333", "#ffaa00", "#fff"]);
                setHealth(Math.max(0, ship.health));
                if (enemy.health <= 0) { enemy.active = false; }
                if (ship.health <= 0) {
                  handlePlayerDeathRef.current(ship, time);
                }
              }
            }
          }
        }

        // Power-up collection
        for (const pu of powerUpsRef.current) {
          if (!pu.active) continue;
          if (Vector2.distance(pu.position, ship.position) < pu.collisionRadius + ship.collisionRadius) {
            pu.active = false;
            activePURef.current = applyPowerUp(ship, pu.powerUpType, time, activePURef.current);
            setActivePowerUps([...activePURef.current]);
            setHealth(ship.health);
            emitParticles(pu.position.x, pu.position.y, 15, 140, [puColorMap[pu.powerUpType] || "#fff", "#fff"], 0.4);
          }
        }

        // Clean up expired bullets after collisions
        bulletsRef.current = bulletsRef.current.filter((b) => b.active);
        enemiesRef.current = enemiesRef.current.filter((e) => e.active);
        powerUpsRef.current = powerUpsRef.current.filter((p) => p.active);

        // ---- WAVE SYSTEM ----
        if (waveState.announcementTimer > 0) {
          waveState.announcementTimer -= dt;
          if (waveState.announcementTimer <= 0) {
            setAnnouncement("");
          }
        }

        if (waveState.betweenWaves) {
          // Start next wave after a short delay
          waveState.betweenWaves = false;
          startNextWave(waveState, w, h);
          const waveDef = waveState.waves[waveState.currentWave - 1];
          setWave(waveState.currentWave);
          const isBoss = waveDef?.isBoss ?? false;
          setAnnouncement(isBoss ? `BOSS FIGHT!` : `WAVE ${waveState.currentWave}`);
          if (isBoss) {
            phaseRef.current = "BOSS";
            setGamePhase("BOSS");
          }
        }

        // Process spawn queue
        waveState.spawnTimer += dt;
        while (waveState.spawnQueue.length > 0 && waveState.spawnQueue[0].delay <= waveState.spawnTimer) {
          const spawn = waveState.spawnQueue.shift()!;
          const enemy = createEnemy(genId("en"), spawn.type, spawn.position, time, waveState.currentWave);
          enemiesRef.current.push(enemy);
        }

        // Check wave clear
        if (waveState.spawnQueue.length === 0 && enemiesRef.current.length === 0 && !waveState.waveCleared) {
          waveState.waveCleared = true;
          waveState.waveClearTime = time;
          setBossHealth(null);
          setBossMaxHealth(null);

          if (phaseRef.current === "BOSS") {
            phaseRef.current = "WAVE_CLEAR";
            setGamePhase("WAVE_CLEAR");
          }

          setAnnouncement("WAVE CLEAR!");
          safeTimeout(() => {
            if (phaseRef.current === "GAME_OVER" || phaseRef.current === "RESULTS") return;
            setAnnouncement("");
            waveState.betweenWaves = true;
            phaseRef.current = "PLAYING";
            setGamePhase("PLAYING");
          }, 2000);
        }

        // Update boss health HUD
        const boss = enemiesRef.current.find((e) => e.enemyType === "boss");
        if (boss) {
          setBossHealth(boss.health);
          setBossMaxHealth(boss.maxHealth);
        }

        // Report state to AI periodically
        if (Math.floor(time) !== Math.floor(time - dt)) {
          updateGameStateForAI({
            status: phaseRef.current,
            score: scoreRef.current,
            wave: waveState.currentWave,
            lives: ship.lives,
            health: ship.health,
            enemiesAlive: enemiesRef.current.length,
          });
        }
      }

      // ---- RENDER ----
      ctx.translate(cam.shakeX, cam.shakeY);

      // Starfield
      renderStarfield(ctx, starsRef.current, w, h, time);

      // Planets
      renderPlanets(ctx, planetsRef.current, cam.x, cam.y, w, h, time);

      // Enemies
      for (const enemy of enemiesRef.current) drawEnemy(ctx, enemy, time);

      // Player ship
      if (ship.active) {
        drawPlayerShip(ctx, ship, time);
        if (damageFlashRef.current > 0) drawDamageFlash(ctx, ship.position.x, ship.position.y, damageFlashRef.current);
      }

      // Bullets
      for (const b of bulletsRef.current) drawBullet(ctx, b);

      // Power-ups
      for (const pu of powerUpsRef.current) drawPowerUp(ctx, pu, time);

      // Particles
      for (const p of particlesRef.current) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Explosions
      for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
        const exp = explosionsRef.current[i];
        const progress = (time - exp.startTime) / exp.duration;
        if (progress >= 1) { explosionsRef.current.splice(i, 1); continue; }
        drawDeathExplosion(ctx, exp.x, exp.y, progress);
      }

      ctx.restore();
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
  }, [spawnBullet, shakeCamera, emitParticles, genId, safeTimeout, updateGameStateForAI, endGame]);

  // ---- Touch controls ----
  const touchRef = useRef<Map<number, "move" | "shoot">>(new Map());
  const touchOriginRef = useRef<Vector2>(Vector2.zero());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (phaseRef.current === "MENU") { startGame(); return; }
      if (phaseRef.current === "RESULTS") { startGame(); return; }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        touchRef.current.set(t.identifier, "move");
        touchOriginRef.current = new Vector2(t.clientX, t.clientY);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (touchRef.current.has(t.identifier)) {
          const dx = t.clientX - touchOriginRef.current.x;
          const dy = t.clientY - touchOriginRef.current.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 10) {
            const nx = dx / len;
            const ny = dy / len;
            // Simulate keyboard
            keysRef.current.delete("ArrowUp"); keysRef.current.delete("ArrowDown");
            keysRef.current.delete("ArrowLeft"); keysRef.current.delete("ArrowRight");
            if (ny < -0.3) keysRef.current.add("ArrowUp");
            if (ny > 0.3) keysRef.current.add("ArrowDown");
            if (nx < -0.3) keysRef.current.add("ArrowLeft");
            if (nx > 0.3) keysRef.current.add("ArrowRight");
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        touchRef.current.delete(e.changedTouches[i].identifier);
      }
      if (touchRef.current.size === 0) {
        keysRef.current.delete("ArrowUp"); keysRef.current.delete("ArrowDown");
        keysRef.current.delete("ArrowLeft"); keysRef.current.delete("ArrowRight");
      }
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [startGame]);

  // ---- Keyboard start ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        if (phaseRef.current === "MENU" || phaseRef.current === "RESULTS") {
          startGame();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startGame]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#050510]">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* HUD Overlay */}
      {(gamePhase === "PLAYING" || gamePhase === "BOSS" || gamePhase === "WAVE_CLEAR") && (
        <div className="pointer-events-none absolute inset-0">
          {/* Top bar */}
          <div className="flex items-start justify-between p-3">
            {/* Score */}
            <div className="rounded-lg bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur">
              Score: <span className="font-bold text-cyan-300">{score.toLocaleString()}</span>
            </div>

            {/* Wave */}
            <div className="rounded-lg bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur">
              Wave <span className="font-bold text-yellow-300">{wave}</span>
            </div>

            {/* Health & Lives */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur">
                <span className="text-xs text-neutral-400">HP</span>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-700">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${(health / maxHealth) * 100}%`,
                      backgroundColor: health > 60 ? "#44ff44" : health > 30 ? "#ffaa00" : "#ff3333",
                    }}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
                Lives: {Array.from({ length: lives }, (_, i) => (
                  <span key={i} className="text-cyan-300">&#9679; </span>
                ))}
              </div>
            </div>
          </div>

          {/* Active power-ups */}
          {activePowerUps.length > 0 && (
            <div className="absolute bottom-3 left-3 flex gap-2">
              {activePowerUps.map((pu, i) => (
                <div key={i} className="rounded bg-black/60 px-2 py-1 text-xs font-bold backdrop-blur" style={{ color: puColorMap[pu.type] || "#fff" }}>
                  {pu.type.toUpperCase()}
                </div>
              ))}
            </div>
          )}

          {/* Boss health bar */}
          {bossHealth !== null && bossMaxHealth !== null && (
            <div className="absolute left-1/2 top-12 -translate-x-1/2">
              <div className="rounded-lg bg-black/70 px-4 py-2 backdrop-blur">
                <div className="mb-1 text-center text-xs font-bold text-red-400">BOSS</div>
                <div className="h-3 w-48 overflow-hidden rounded-full bg-neutral-700">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all duration-200"
                    style={{ width: `${(bossHealth / bossMaxHealth) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Announcement */}
          {announcement && (
            <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
              <div className="animate-pulse text-center text-4xl font-black tracking-wider text-white drop-shadow-[0_0_20px_rgba(0,200,255,0.8)]">
                {announcement}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Menu overlay */}
      {gamePhase === "MENU" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
          <h1 className="mb-4 text-5xl font-black tracking-wider text-cyan-300 drop-shadow-[0_0_30px_rgba(0,200,255,0.6)]">
            SPACE SHOOTER
          </h1>
          <p className="mb-8 text-lg text-neutral-300">Defend the galaxy!</p>
          <button
            onClick={startGame}
            className="rounded-lg bg-cyan-600 px-8 py-3 text-lg font-bold text-white transition-colors hover:bg-cyan-500"
          >
            START GAME
          </button>
          <p className="mt-4 text-sm text-neutral-500">WASD/Arrows to move &middot; Auto-fire enabled</p>
          <p className="text-sm text-neutral-500">Tap and drag on mobile</p>
        </div>
      )}

      {/* Game Over overlay */}
      {gamePhase === "GAME_OVER" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse text-5xl font-black text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,0.6)]">
            GAME OVER
          </div>
        </div>
      )}

      {/* Results overlay */}
      {gamePhase === "RESULTS" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <h2 className="mb-6 text-4xl font-black text-cyan-300">MISSION COMPLETE</h2>
          <div className="mb-2 text-2xl text-white">Score: <span className="font-bold text-yellow-300">{score.toLocaleString()}</span></div>
          <div className="mb-2 text-lg text-neutral-300">Waves Survived: {wave}</div>
          <div className="mb-6 text-lg text-neutral-300">Enemies Destroyed: {enemiesDestroyed}</div>
          <button
            onClick={startGame}
            className="rounded-lg bg-cyan-600 px-8 py-3 text-lg font-bold text-white transition-colors hover:bg-cyan-500"
          >
            PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  );
};

// ---- Render helpers (called in canvas context) ----

function renderStarfield(ctx: CanvasRenderingContext2D, stars: StarBg[], w: number, h: number, time: number): void {
  for (const s of stars) {
    const twinkle = 0.6 + 0.4 * Math.sin(time * s.twinkleSpeed + s.x);
    ctx.globalAlpha = s.brightness * twinkle;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function renderMenu(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  for (let i = 0; i < 50; i++) {
    const x = (Math.sin(i * 127.1 + time * 0.1) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 311.7 + time * 0.05) * 0.5 + 0.5) * h;
    const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + i);
    const size = 1 + Math.abs(Math.sin(i * 43.7)) * 1.5;
    ctx.globalAlpha = twinkle * 0.6;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function renderResults(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  renderMenu(ctx, w, h, performance.now() / 1000);
}

const puColorMap: Record<string, string> = {
  health: "#44ff44",
  shield: "#4488ff",
  rapidFire: "#ffaa00",
  spread: "#ff44ff",
  missile: "#ff6600",
  speedBoost: "#00ffaa",
};
