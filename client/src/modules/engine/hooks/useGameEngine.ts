/**
 * Game Engine — React Hook
 * Sets up canvas, input, game loop, entity manager, camera, particles, audio, renderer.
 * Auto-cleanup on unmount. Handles responsive canvas resize.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import type { GameConfig } from "../types";
import { InputManager } from "../input-manager";
import { createGameLoop, type GameLoop } from "../game-loop";
import { EntityManager } from "../entity-manager";
import { Camera } from "../camera";
import { ParticleEmitter } from "../particles";
import { AudioManager } from "../audio-manager";
import { Renderer } from "../renderer";

export interface GameEngine {
  entities: EntityManager;
  input: InputManager;
  camera: Camera;
  particles: ParticleEmitter;
  audio: AudioManager;
  renderer: Renderer;
  loop: GameLoop | null;
  /** Register an update callback. Returns unsubscribe. */
  onUpdate(fn: (dt: number) => void): () => void;
  /** Register a render callback. Returns unsubscribe. */
  onRender(fn: (ctx: CanvasRenderingContext2D) => void): () => void;
  /** Get the canvas 2D context. */
  getContext(): CanvasRenderingContext2D | null;
  /** Elapsed time in seconds since engine started. */
  time: number;
}

export function useGameEngine(config: GameConfig) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [fps, setFps] = useState(0);

  const engineRef = useRef<GameEngine | null>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const updateCallbacks = useRef(new Set<(dt: number) => void>());
  const renderCallbacks = useRef(new Set<(ctx: CanvasRenderingContext2D) => void>());
  const timeRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Build engine once
  if (!engineRef.current) {
    const entities = new EntityManager();
    const input = new InputManager();
    const camera = new Camera();
    const particles = new ParticleEmitter();
    const audio = new AudioManager();
    const renderer = new Renderer();

    engineRef.current = {
      entities,
      input,
      camera,
      particles,
      audio,
      renderer,
      loop: null,
      onUpdate(fn) {
        updateCallbacks.current.add(fn);
        return () => { updateCallbacks.current.delete(fn); };
      },
      onRender(fn) {
        renderCallbacks.current.add(fn);
        return () => { renderCallbacks.current.delete(fn); };
      },
      getContext() {
        return canvasRef.current?.getContext("2d") ?? null;
      },
      time: 0,
    };
  }

  // Setup canvas, input, resize, loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    // Attach input
    engine.input.attach(canvas);

    // Resize handler
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = config.pixelRatio ?? window.devicePixelRatio ?? 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      engine.camera.setViewport(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    // Create game loop
    const loop = createGameLoop(
      () => canvas.getContext("2d"),
      {
        onUpdate(dt) {
          timeRef.current += dt;
          engine.time = timeRef.current;
          engine.input.pollGamepad();
          engine.camera.update(dt);
          engine.particles.update(dt);
          engine.renderer.updateEffects(dt);
          engine.entities.update(dt);
          for (const fn of updateCallbacks.current) fn(dt);
        },
        onRender(ctx, _interpolation) {
          // Clear
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (config.backgroundColor) {
            ctx.fillStyle = config.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          // User render callbacks (they manage camera transforms themselves)
          for (const fn of renderCallbacks.current) fn(ctx);

          // Render entities with camera transform
          engine.camera.applyTransform(ctx);
          engine.entities.render(ctx);
          engine.particles.renderDirect(ctx);
          engine.camera.restoreTransform(ctx);

          // Screen effects overlay
          engine.renderer.renderEffects(ctx, canvas.width, canvas.height);
        },
      },
      { updateRate: config.maxFPS ?? 60 },
    );

    loopRef.current = loop;
    engine.loop = loop;

    // FPS polling
    fpsIntervalRef.current = setInterval(() => {
      if (loopRef.current) {
        setFps(loopRef.current.getStats().fps);
      }
    }, 500);

    return () => {
      loop.dispose();
      engine.input.dispose();
      engine.entities.dispose();
      engine.camera.dispose();
      engine.particles.dispose();
      engine.audio.dispose();
      engine.renderer.dispose();
      window.removeEventListener("resize", resize);
      observer.disconnect();
      clearInterval(fpsIntervalRef.current);
      updateCallbacks.current.clear();
      renderCallbacks.current.clear();
    };
  }, [config.backgroundColor, config.maxFPS, config.pixelRatio]);

  // ---- Controls ----

  const start = useCallback(() => {
    loopRef.current?.start();
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    loopRef.current?.stop();
    setIsRunning(false);
  }, []);

  const restart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    loopRef.current?.stop();
    timeRef.current = 0;
    engine.time = 0;
    engine.entities.clear();
    engine.particles.clear();
    loopRef.current?.start();
    setIsRunning(true);
  }, []);

  return {
    canvasRef,
    engine: engineRef.current!,
    isRunning,
    fps,
    start,
    stop,
    restart,
  };
}
