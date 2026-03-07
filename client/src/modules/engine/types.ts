/**
 * Game Engine — Core Type Definitions
 */

// ---- Vector2 ----

export class Vector2 {
  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {}

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: Vector2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  add(v: Vector2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: Vector2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): this {
    const m = this.magnitude();
    if (m > 0) {
      this.x /= m;
      this.y /= m;
    }
    return this;
  }

  distanceTo(v: Vector2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  lerp(v: Vector2, t: number): this {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }

  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  // ---- Static factories ----

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  static add(a: Vector2, b: Vector2): Vector2 {
    return new Vector2(a.x + b.x, a.y + b.y);
  }

  static sub(a: Vector2, b: Vector2): Vector2 {
    return new Vector2(a.x - b.x, a.y - b.y);
  }

  static scale(v: Vector2, s: number): Vector2 {
    return new Vector2(v.x * s, v.y * s);
  }

  static normalize(v: Vector2): Vector2 {
    return v.clone().normalize();
  }

  static distance(a: Vector2, b: Vector2): number {
    return a.distanceTo(b);
  }

  static magnitude(v: Vector2): number {
    return v.magnitude();
  }

  static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return new Vector2(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
    );
  }
}

// ---- Rect ----

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---- Entity ----

export interface Entity {
  id: string;
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  scale: number;
  active: boolean;
  tags: string[];
  layer: number;
  collisionRadius: number;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}

// ---- InputState ----

export interface InputState {
  keys: Map<string, boolean>;
  pointerPosition: Vector2;
  pointerDown: boolean;
  gamepadAxes: Vector2;
}

// ---- GameConfig ----

export interface GameConfig {
  width: number;
  height: number;
  backgroundColor?: string;
  pixelRatio?: number;
  maxFPS?: number;
}

// ---- CameraState ----

export interface CameraState {
  position: Vector2;
  zoom: number;
  rotation: number;
  shake: number;
}

// ---- Particle ----

export interface Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  gravity: number;
}

// ---- ParticleEmitterConfig ----

export interface ParticleEmitterConfig {
  position: Vector2;
  count: number;
  speed?: number;
  spread?: number;
  angle?: number;
  life?: number;
  size?: number;
  color?: string;
  colors?: string[];
  gravity?: number;
  fade?: boolean;
}

// ---- LoopStats ----

export interface LoopStats {
  fps: number;
  frameTime: number;
  updateTime: number;
}

// ---- Star (for starfield) ----

export interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  speed: number;
}
