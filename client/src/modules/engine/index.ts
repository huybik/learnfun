/**
 * Game Engine Module
 * 2D game engine for HTML5 Canvas — input, game loop, entities,
 * camera, particles, audio, rendering, and React hooks.
 */

// ---- Core Types ----
export { Vector2, type Rect, type Entity, type InputState, type GameConfig } from "./types";
export { type CameraState, type Particle, type ParticleEmitterConfig, type LoopStats, type Star } from "./types";

// ---- Systems ----
export { InputManager } from "./input-manager";
export { createGameLoop, type GameLoop, type GameLoopConfig, type GameLoopCallbacks } from "./game-loop";
export { EntityManager } from "./entity-manager";
export { Camera } from "./camera";
export { ParticleEmitter } from "./particles";
export { AudioManager } from "./audio-manager";
export { Renderer } from "./renderer";

// ---- Hooks ----
export { useGameEngine, type GameEngine } from "./hooks/useGameEngine";
export { useVirtualJoystick } from "./hooks/useVirtualJoystick";
