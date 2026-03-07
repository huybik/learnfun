/**
 * Game Engine — Particle System
 * Pool-based particle emitter with presets for common effects.
 */

import { Vector2, type Particle, type ParticleEmitterConfig } from "./types";
import type { Camera } from "./camera";

const MAX_PARTICLES = 2000;

export class ParticleEmitter {
  /** Live particles. Pool-based: dead particles stay in array, compacted periodically. */
  private particles: Particle[] = [];
  private activeCount = 0;

  // ---- Emit ----

  private deadSearchIndex = 0;

  emit(config: ParticleEmitterConfig): void {
    const {
      position,
      count,
      speed = 100,
      spread = Math.PI * 2,
      angle = 0,
      life = 0.5,
      size = 3,
      color,
      colors,
      gravity = 0,
    } = config;

    for (let i = 0; i < count; i++) {
      if (this.activeCount >= MAX_PARTICLES) break;

      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random() * 0.5);
      const c = colors
        ? colors[Math.floor(Math.random() * colors.length)]
        : color || "#fff";
      const lifeVar = life * (0.7 + Math.random() * 0.6);

      // Reuse dead particle from pool
      const dead = this.findDead();
      if (dead) {
        dead.position.copy(position);
        dead.velocity.set(Math.cos(a) * s, Math.sin(a) * s);
        dead.life = lifeVar;
        dead.maxLife = lifeVar;
        dead.size = size * (0.5 + Math.random() * 0.5);
        dead.color = c;
        dead.alpha = 1;
        dead.gravity = gravity;
      } else {
        this.particles.push({
          position: position.clone(),
          velocity: new Vector2(Math.cos(a) * s, Math.sin(a) * s),
          life: lifeVar,
          maxLife: lifeVar,
          size: size * (0.5 + Math.random() * 0.5),
          color: c,
          alpha: 1,
          gravity,
        });
      }
      this.activeCount++;
    }
  }

  private findDead(): Particle | null {
    const len = this.particles.length;
    for (let i = 0; i < len; i++) {
      const idx = (this.deadSearchIndex + i) % len;
      if (this.particles[idx].life <= 0) {
        this.deadSearchIndex = (idx + 1) % len;
        return this.particles[idx];
      }
    }
    return null;
  }

  // ---- Update ----

  update(dt: number): void {
    this.activeCount = 0;
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.velocity.y += p.gravity * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size *= 0.995;
      if (p.life > 0) this.activeCount++;
    }

    // Compact array if it's gotten too large with dead particles
    if (this.particles.length > MAX_PARTICLES * 2 && this.activeCount < this.particles.length / 2) {
      this.particles = this.particles.filter((p) => p.life > 0);
    }
  }

  // ---- Render ----

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const TWO_PI = Math.PI * 2;
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      const r = p.size * camera.zoom;
      if (r < 0.5) continue;
      const screen = camera.worldToScreen(p.position);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, r, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Render without camera transform (already applied to context). */
  renderDirect(ctx: CanvasRenderingContext2D): void {
    const TWO_PI = Math.PI * 2;
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.size, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Presets ----

  static explosion(emitter: ParticleEmitter, pos: Vector2, color = "#ff6622"): void {
    emitter.emit({
      position: pos,
      count: 30,
      speed: 200,
      life: 0.6,
      size: 4,
      colors: [color, "#ffaa00", "#ff4400", "#fff"],
    });
  }

  static thrust(emitter: ParticleEmitter, pos: Vector2, angle: number): void {
    emitter.emit({
      position: pos,
      count: 2,
      speed: 80,
      spread: 0.4,
      angle: angle + Math.PI,
      life: 0.3,
      size: 3,
      colors: ["#00ccff", "#0088ff", "#44eeff"],
    });
  }

  static sparkle(emitter: ParticleEmitter, pos: Vector2, color = "#ffff00"): void {
    emitter.emit({
      position: pos,
      count: 15,
      speed: 120,
      life: 0.5,
      size: 3,
      colors: [color, "#fff"],
    });
  }

  static smoke(emitter: ParticleEmitter, pos: Vector2): void {
    emitter.emit({
      position: pos,
      count: 8,
      speed: 30,
      spread: Math.PI,
      angle: -Math.PI / 2,
      life: 1.5,
      size: 6,
      gravity: -20,
      colors: ["#666", "#888", "#aaa", "#555"],
    });
  }

  // ---- Cleanup ----

  clear(): void {
    this.particles = [];
    this.activeCount = 0;
    this.deadSearchIndex = 0;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  dispose(): void {
    this.clear();
  }
}
