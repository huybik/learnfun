/**
 * Game Engine — 2D Camera
 * Follow target with smoothing, screen shake, world/screen transforms, viewport culling.
 */

import { Vector2 } from "./types";

export class Camera {
  position = Vector2.zero();
  zoom = 1;
  rotation = 0;
  width = 0;
  height = 0;

  private target: Vector2 | null = null;
  private followSmoothing = 5;
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;
  private shakeOffset = Vector2.zero();

  // ---- Viewport ----

  setViewport(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }

  // ---- Follow ----

  follow(target: Vector2, smoothing = 5): void {
    this.target = target;
    this.followSmoothing = smoothing;
  }

  stopFollow(): void {
    this.target = null;
  }

  // ---- Shake ----

  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = 0;
  }

  // ---- Update ----

  update(dt: number): void {
    // Follow target with lerp smoothing
    if (this.target) {
      const t = Math.min(1, this.followSmoothing * dt);
      this.position.lerp(this.target, t);
    }

    // Update shake
    if (this.shakeTimer < this.shakeDuration) {
      this.shakeTimer += dt;
      const decay = 1 - this.shakeTimer / this.shakeDuration;
      this.shakeOffset.set(
        (Math.random() - 0.5) * 2 * this.shakeIntensity * decay,
        (Math.random() - 0.5) * 2 * this.shakeIntensity * decay,
      );
    } else {
      this.shakeOffset.set(0, 0);
    }
  }

  // ---- Coordinate Transforms ----

  worldToScreen(world: Vector2): Vector2 {
    const dx = (world.x - this.position.x + this.shakeOffset.x) * this.zoom;
    const dy = (world.y - this.position.y + this.shakeOffset.y) * this.zoom;

    if (this.rotation === 0) {
      return new Vector2(dx + this.width / 2, dy + this.height / 2);
    }

    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    return new Vector2(
      dx * cos - dy * sin + this.width / 2,
      dx * sin + dy * cos + this.height / 2,
    );
  }

  screenToWorld(screen: Vector2): Vector2 {
    let dx = screen.x - this.width / 2;
    let dy = screen.y - this.height / 2;

    if (this.rotation !== 0) {
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx;
      dy = ry;
    }

    return new Vector2(
      dx / this.zoom + this.position.x - this.shakeOffset.x,
      dy / this.zoom + this.position.y - this.shakeOffset.y,
    );
  }

  // ---- Canvas Context Transform ----

  /** Apply camera transform to canvas context. Call before rendering scene. */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    if (this.rotation !== 0) ctx.rotate(-this.rotation);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(
      -this.position.x + this.shakeOffset.x,
      -this.position.y + this.shakeOffset.y,
    );
  }

  /** Restore canvas context after scene rendering. */
  restoreTransform(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  // ---- Culling ----

  /** Check if a world position is visible on screen (with padding). */
  isVisible(world: Vector2, padding = 100): boolean {
    const dx = (world.x - this.position.x + this.shakeOffset.x) * this.zoom;
    const dy = (world.y - this.position.y + this.shakeOffset.y) * this.zoom;
    let sx: number, sy: number;

    if (this.rotation === 0) {
      sx = dx + this.width / 2;
      sy = dy + this.height / 2;
    } else {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      sx = dx * cos - dy * sin + this.width / 2;
      sy = dx * sin + dy * cos + this.height / 2;
    }

    return (
      sx > -padding &&
      sx < this.width + padding &&
      sy > -padding &&
      sy < this.height + padding
    );
  }

  /** Get the visible world bounds (axis-aligned, ignoring rotation). */
  getWorldBounds(): { left: number; right: number; top: number; bottom: number } {
    const hw = this.width / (2 * this.zoom);
    const hh = this.height / (2 * this.zoom);
    return {
      left: this.position.x - hw,
      right: this.position.x + hw,
      top: this.position.y - hh,
      bottom: this.position.y + hh,
    };
  }

  getShakeOffset(): Vector2 {
    return this.shakeOffset.clone();
  }

  dispose(): void {
    this.target = null;
  }
}
