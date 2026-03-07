/**
 * Game Engine — Unified Input Manager
 * Handles keyboard, mouse, touch, virtual joystick, and gamepad input.
 */

import { Vector2 } from "./types";

export class InputManager {
  private keys = new Set<string>();
  private pointerPos = new Vector2();
  private pointerIsDown = false;
  private canvas: HTMLCanvasElement | null = null;
  private joystickMove = Vector2.zero();
  private joystickAim = Vector2.zero();
  private gamepadIndex: number | null = null;
  private gamepadAxesVec = Vector2.zero();
  private canvasRect: DOMRect | null = null;

  // ---- Attach / Detach ----

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvasRect = canvas.getBoundingClientRect();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerUp);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("gamepadconnected", this.onGamepadConnected);
    window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("pointerleave", this.onPointerUp);
      this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    }
    window.removeEventListener("gamepadconnected", this.onGamepadConnected);
    window.removeEventListener("gamepaddisconnected", this.onGamepadDisconnected);
    this.canvas = null;
    this.canvasRect = null;
    this.keys.clear();
  }

  dispose(): void {
    this.detach();
  }

  // ---- Keyboard ----

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  // ---- Pointer (mouse + touch unified) ----

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerIsDown = true;
    this.updatePointerPos(e);
  };

  private onPointerUp = (): void => {
    this.pointerIsDown = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.updatePointerPos(e);
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private updatePointerPos(e: PointerEvent): void {
    if (!this.canvas) return;
    // Lazily refresh rect (handles scroll/resize)
    this.canvasRect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.pointerPos.set(
      (e.clientX - this.canvasRect.left) * dpr,
      (e.clientY - this.canvasRect.top) * dpr,
    );
  }

  isPointerDown(): boolean {
    return this.pointerIsDown;
  }

  getPointerPosition(): Vector2 {
    return this.pointerPos.clone();
  }

  // ---- Virtual Joystick (set externally by useVirtualJoystick) ----

  setJoystickMove(v: Vector2): void {
    this.joystickMove = v;
  }

  setJoystickAim(v: Vector2): void {
    this.joystickAim = v;
  }

  // ---- Gamepad ----

  private onGamepadConnected = (e: GamepadEvent): void => {
    this.gamepadIndex = e.gamepad.index;
  };

  private onGamepadDisconnected = (): void => {
    this.gamepadIndex = null;
    this.gamepadAxesVec.set(0, 0);
  };

  /** Call once per frame to poll gamepad state. */
  pollGamepad(): void {
    if (this.gamepadIndex === null) return;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (!gp) return;
    // Left stick: axes 0,1
    const lx = Math.abs(gp.axes[0]) > 0.15 ? gp.axes[0] : 0;
    const ly = Math.abs(gp.axes[1]) > 0.15 ? gp.axes[1] : 0;
    this.gamepadAxesVec.set(lx, ly);
  }

  // ---- Composite Queries ----

  /**
   * Returns movement direction from WASD / arrow keys / left joystick / gamepad.
   * Normalized vector with components in [-1, 1].
   */
  private movementResult = Vector2.zero();

  getMovementAxis(): Vector2 {
    // Keyboard
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;

    if (x !== 0 || y !== 0) {
      return this.movementResult.set(x, y).normalize();
    }

    // Virtual joystick
    if (this.joystickMove.magnitude() > 0.1) {
      return this.movementResult.copy(this.joystickMove);
    }

    // Gamepad
    if (this.gamepadAxesVec.magnitude() > 0.15) {
      return this.movementResult.copy(this.gamepadAxesVec);
    }

    return this.movementResult.set(0, 0);
  }

  /**
   * Returns aim direction from mouse position (relative to canvas center) or right joystick.
   * Returns zero if no aim input.
   */
  private aimResult = Vector2.zero();

  getAimDirection(): Vector2 {
    // Virtual joystick aim takes priority
    if (this.joystickAim.magnitude() > 0.1) {
      return this.aimResult.copy(this.joystickAim).normalize();
    }
    // Mouse: direction from canvas center to pointer
    if (this.canvas && this.pointerIsDown) {
      const dpr = window.devicePixelRatio || 1;
      const cx = this.canvas.width / (2 * dpr);
      const cy = this.canvas.height / (2 * dpr);
      this.aimResult.set(
        this.pointerPos.x / dpr - cx,
        this.pointerPos.y / dpr - cy,
      );
      if (this.aimResult.magnitude() > 5) return this.aimResult.normalize();
    }
    return this.aimResult.set(0, 0);
  }
}
