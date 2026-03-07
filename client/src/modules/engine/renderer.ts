/**
 * Game Engine — Canvas2D Rendering Utilities
 * Sprite drawing, shapes, text, starfield, screen effects, camera integration.
 */

import type { Star } from "./types";
import type { Camera } from "./camera";

// ---- Sprite cache ----

const imageCache = new Map<string, HTMLImageElement>();

function getImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached) return cached.complete ? cached : null;
  const img = new Image();
  img.src = src;
  imageCache.set(src, img);
  return null;
}

// ---- Renderer ----

export class Renderer {
  private flashAlpha = 0;
  private flashColor = "#fff";
  private flashDecay = 0;
  private fadeAlpha = 0;
  private fadeColor = "#000";
  private fadeTarget = 0;
  private fadeSpeed = 0;

  // ---- Sprites ----

  /** Draw an image/sprite with rotation, scale, and alpha. */
  static drawSprite(
    ctx: CanvasRenderingContext2D,
    src: string,
    x: number,
    y: number,
    opts?: {
      width?: number;
      height?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
      alpha?: number;
      sourceRect?: { sx: number; sy: number; sw: number; sh: number };
    },
  ): void {
    const img = getImage(src);
    if (!img) return;

    const w = opts?.width ?? img.naturalWidth;
    const h = opts?.height ?? img.naturalHeight;
    const hasTransform =
      opts?.rotation !== undefined ||
      opts?.scaleX !== undefined ||
      opts?.scaleY !== undefined ||
      opts?.alpha !== undefined;

    if (hasTransform) {
      ctx.save();
      ctx.translate(x, y);
      if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha;
      if (opts?.rotation) ctx.rotate(opts.rotation);
      const sx = opts?.scaleX ?? 1;
      const sy = opts?.scaleY ?? 1;
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);

      if (opts?.sourceRect) {
        const { sx: srcX, sy: srcY, sw, sh } = opts.sourceRect;
        ctx.drawImage(img, srcX, srcY, sw, sh, -w / 2, -h / 2, w, h);
      } else {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    } else {
      if (opts?.sourceRect) {
        const { sx: srcX, sy: srcY, sw, sh } = opts.sourceRect;
        ctx.drawImage(img, srcX, srcY, sw, sh, x - w / 2, y - h / 2, w, h);
      } else {
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
      }
    }
  }

  // ---- Shapes ----

  static drawCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    opts?: { fill?: string; stroke?: string; lineWidth?: number; alpha?: number },
  ): void {
    if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (opts?.fill) {
      ctx.fillStyle = opts.fill;
      ctx.fill();
    }
    if (opts?.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = opts?.lineWidth ?? 1;
      ctx.stroke();
    }
    if (opts?.alpha !== undefined) ctx.globalAlpha = 1;
  }

  static drawRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { fill?: string; stroke?: string; lineWidth?: number; alpha?: number },
  ): void {
    if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts?.fill) {
      ctx.fillStyle = opts.fill;
      ctx.fillRect(x, y, w, h);
    }
    if (opts?.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = opts?.lineWidth ?? 1;
      ctx.strokeRect(x, y, w, h);
    }
    if (opts?.alpha !== undefined) ctx.globalAlpha = 1;
  }

  static drawLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts?: { color?: string; lineWidth?: number; alpha?: number },
  ): void {
    if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.strokeStyle = opts?.color ?? "#fff";
    ctx.lineWidth = opts?.lineWidth ?? 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (opts?.alpha !== undefined) ctx.globalAlpha = 1;
  }

  // ---- Text ----

  static drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    opts?: {
      color?: string;
      font?: string;
      align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline;
      shadow?: { color: string; blur: number; offsetX?: number; offsetY?: number };
      alpha?: number;
      maxWidth?: number;
    },
  ): void {
    if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.fillStyle = opts?.color ?? "#fff";
    ctx.font = opts?.font ?? "16px sans-serif";
    ctx.textAlign = opts?.align ?? "center";
    ctx.textBaseline = opts?.baseline ?? "middle";

    if (opts?.shadow) {
      ctx.shadowColor = opts.shadow.color;
      ctx.shadowBlur = opts.shadow.blur;
      ctx.shadowOffsetX = opts.shadow.offsetX ?? 0;
      ctx.shadowOffsetY = opts.shadow.offsetY ?? 2;
    }

    if (opts?.maxWidth) {
      ctx.fillText(text, x, y, opts.maxWidth);
    } else {
      ctx.fillText(text, x, y);
    }

    if (opts?.shadow) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    if (opts?.alpha !== undefined) ctx.globalAlpha = 1;
  }

  // ---- Starfield ----

  static createStarfield(count: number, width: number, height: number): Star[] {
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width * 3 - width,
        y: Math.random() * height * 3 - height,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.5,
        speed: Math.random() * 3 + 1,
      });
    }
    return stars;
  }

  static renderStarfield(
    ctx: CanvasRenderingContext2D,
    stars: Star[],
    camera: Camera,
    time: number,
    parallaxFactor = 0.1,
  ): void {
    for (const star of stars) {
      const sx = star.x - camera.position.x * parallaxFactor;
      const sy = star.y - camera.position.y * parallaxFactor;
      const wrappedX = ((sx % camera.width) + camera.width) % camera.width;
      const wrappedY = ((sy % camera.height) + camera.height) % camera.height;
      const twinkle = 0.6 + 0.4 * Math.sin(time * star.speed + star.x);
      ctx.globalAlpha = star.brightness * twinkle;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(wrappedX, wrappedY, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Screen Effects ----

  /** Trigger a screen flash (white hit flash, etc). */
  flash(color = "#fff", duration = 0.15): void {
    this.flashAlpha = 1;
    this.flashColor = color;
    this.flashDecay = 1 / duration;
  }

  /** Start a screen fade. target=1 for fade-to-black, target=0 for fade-in. */
  fade(target: number, speed = 2, color = "#000"): void {
    this.fadeTarget = target;
    this.fadeSpeed = speed;
    this.fadeColor = color;
  }

  /** Update screen effects. Call once per frame. */
  updateEffects(dt: number): void {
    // Flash decay
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - this.flashDecay * dt);
    }
    // Fade lerp
    if (this.fadeAlpha !== this.fadeTarget) {
      const dir = this.fadeTarget > this.fadeAlpha ? 1 : -1;
      this.fadeAlpha += dir * this.fadeSpeed * dt;
      if (dir > 0 && this.fadeAlpha > this.fadeTarget) this.fadeAlpha = this.fadeTarget;
      if (dir < 0 && this.fadeAlpha < this.fadeTarget) this.fadeAlpha = this.fadeTarget;
    }
  }

  /** Render screen effects overlay. Call after all scene rendering. */
  renderEffects(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.flashAlpha > 0.01) {
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    if (this.fadeAlpha > 0.01) {
      ctx.globalAlpha = this.fadeAlpha;
      ctx.fillStyle = this.fadeColor;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
  }

  // ---- Camera-Aware Scene Rendering ----

  /**
   * Render a scene with camera transform applied.
   * Wraps the callback in camera.applyTransform / camera.restoreTransform.
   */
  static renderScene(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    renderFn: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    camera.applyTransform(ctx);
    renderFn(ctx);
    camera.restoreTransform(ctx);
  }

  // ---- Preload ----

  static preloadImage(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = imageCache.get(src);
      if (existing?.complete) { resolve(); return; }
      const img = new Image();
      img.onload = () => { imageCache.set(src, img); resolve(); };
      img.onerror = reject;
      img.src = src;
      imageCache.set(src, img);
    });
  }

  dispose(): void {
    this.flashAlpha = 0;
    this.fadeAlpha = 0;
  }
}
