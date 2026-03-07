/**
 * Game Engine — Fixed-Timestep Game Loop
 * Uses requestAnimationFrame with a fixed update step and variable rendering.
 */

import type { LoopStats } from "./types";

export interface GameLoopConfig {
  /** Fixed update rate in Hz (default: 60) */
  updateRate?: number;
  /** Max frame delta in ms to prevent spiral of death (default: 100) */
  maxFrameTime?: number;
}

export interface GameLoopCallbacks {
  onUpdate: (dt: number) => void;
  onRender: (ctx: CanvasRenderingContext2D, interpolation: number) => void;
}

export interface GameLoop {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getStats(): LoopStats;
  isPaused(): boolean;
  isRunning(): boolean;
  dispose(): void;
}

export function createGameLoop(
  getCtx: () => CanvasRenderingContext2D | null,
  callbacks: GameLoopCallbacks,
  config: GameLoopConfig = {},
): GameLoop {
  const updateRate = config.updateRate ?? 60;
  const fixedDt = 1 / updateRate;
  const maxFrameTime = (config.maxFrameTime ?? 100) / 1000;

  let running = false;
  let paused = false;
  let animFrame = 0;
  let lastTime = 0;
  let accumulator = 0;

  // FPS tracking
  let fpsFrames = 0;
  let fpsAccum = 0;
  let currentFps = 0;
  let lastFrameTime = 0;
  let lastUpdateTime = 0;

  const loop = (now: number): void => {
    if (!running) return;
    animFrame = requestAnimationFrame(loop);

    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    lastFrameTime = rawDt * 1000;

    // Skip if paused (still request frames so we can resume)
    if (paused) return;

    // Cap delta to prevent spiral of death
    const frameDt = Math.min(rawDt, maxFrameTime);
    accumulator += frameDt;

    // Fixed-step updates
    const updateStart = performance.now();
    while (accumulator >= fixedDt) {
      callbacks.onUpdate(fixedDt);
      accumulator -= fixedDt;
    }
    lastUpdateTime = performance.now() - updateStart;

    // Render with interpolation factor
    const ctx = getCtx();
    if (ctx) {
      const interpolation = accumulator / fixedDt;
      callbacks.onRender(ctx, interpolation);
    }

    // FPS counting
    fpsAccum += rawDt;
    fpsFrames++;
    if (fpsAccum >= 1) {
      currentFps = Math.round(fpsFrames / fpsAccum);
      fpsFrames = 0;
      fpsAccum = 0;
    }
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      paused = false;
      lastTime = performance.now();
      accumulator = 0;
      animFrame = requestAnimationFrame(loop);
    },

    stop(): void {
      running = false;
      paused = false;
      cancelAnimationFrame(animFrame);
    },

    pause(): void {
      paused = true;
    },

    resume(): void {
      if (paused) {
        paused = false;
        lastTime = performance.now();
        accumulator = 0;
      }
    },

    isPaused(): boolean {
      return paused;
    },

    isRunning(): boolean {
      return running;
    },

    getStats(): LoopStats {
      return {
        fps: currentFps,
        frameTime: lastFrameTime,
        updateTime: lastUpdateTime,
      };
    },

    dispose(): void {
      this.stop();
    },
  };
}
