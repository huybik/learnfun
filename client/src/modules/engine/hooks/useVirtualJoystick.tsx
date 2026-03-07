/**
 * Game Engine — Virtual Joystick Hook
 * Renders two translucent joystick zones on touch devices.
 * Left side = movement, Right side = aim/shoot.
 * Returns movement and aim as Vector2. Auto-hides on non-touch devices.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { Vector2 } from "../types";

interface JoystickState {
  active: boolean;
  origin: Vector2;
  current: Vector2;
  output: Vector2;
}

const DEADZONE = 15;
const MAX_DIST = 60;
const JOYSTICK_RADIUS = 60;
const KNOB_RADIUS = 25;

function newJoystickState(): JoystickState {
  return { active: false, origin: Vector2.zero(), current: Vector2.zero(), output: Vector2.zero() };
}

export function useVirtualJoystick() {
  const moveRef = useRef<JoystickState>(newJoystickState());
  const aimRef = useRef<JoystickState>(newJoystickState());
  const touchMapRef = useRef(new Map<number, "move" | "aim">());
  const [movement, setMovement] = useState(Vector2.zero());
  const [aim, setAim] = useState(Vector2.zero());
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect touch device
  useEffect(() => {
    const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouchScreen);
  }, []);

  const computeOutput = useCallback((state: JoystickState): Vector2 => {
    const dx = state.current.x - state.origin.x;
    const dy = state.current.y - state.origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < DEADZONE) return Vector2.zero();
    const clamped = Math.min(dist, MAX_DIST);
    const norm = new Vector2(dx / dist, dy / dist);
    return norm.scale(clamped / MAX_DIST);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const w = window.innerWidth;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const pos = new Vector2(t.clientX, t.clientY);
      if (t.clientX < w / 2) {
        moveRef.current = { active: true, origin: pos.clone(), current: pos, output: Vector2.zero() };
        touchMapRef.current.set(t.identifier, "move");
      } else {
        aimRef.current = { active: true, origin: pos.clone(), current: pos, output: Vector2.zero() };
        touchMapRef.current.set(t.identifier, "aim");
      }
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const type = touchMapRef.current.get(t.identifier);
      if (!type) continue;
      const pos = new Vector2(t.clientX, t.clientY);
      if (type === "move") {
        moveRef.current.current = pos;
        moveRef.current.output = computeOutput(moveRef.current);
        setMovement(moveRef.current.output);
      } else {
        aimRef.current.current = pos;
        aimRef.current.output = computeOutput(aimRef.current);
        setAim(aimRef.current.output);
      }
    }
  }, [computeOutput]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const type = touchMapRef.current.get(t.identifier);
      touchMapRef.current.delete(t.identifier);
      if (type === "move") {
        moveRef.current = newJoystickState();
        setMovement(Vector2.zero());
      } else if (type === "aim") {
        aimRef.current = newJoystickState();
        setAim(Vector2.zero());
      }
    }
  }, []);

  useEffect(() => {
    if (!isTouchDevice) return;
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isTouchDevice, handleTouchStart, handleTouchMove, handleTouchEnd]);

  /**
   * Render the joystick overlay. Place this component inside your game container.
   * Returns null on non-touch devices.
   */
  const JoystickOverlay = useCallback(() => {
    if (!isTouchDevice) return null;

    const baseStyle: React.CSSProperties = {
      position: "absolute",
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.3)",
      backgroundColor: "rgba(255,255,255,0.08)",
      pointerEvents: "none",
      width: JOYSTICK_RADIUS * 2,
      height: JOYSTICK_RADIUS * 2,
      transform: "translate(-50%, -50%)",
    };

    const knobStyle: React.CSSProperties = {
      position: "absolute",
      borderRadius: "50%",
      backgroundColor: "rgba(255,255,255,0.4)",
      width: KNOB_RADIUS * 2,
      height: KNOB_RADIUS * 2,
      transform: "translate(-50%, -50%)",
      top: "50%",
      left: "50%",
    };

    const renderJoystick = (state: JoystickState) => {
      if (!state.active) return null;
      const knobDx = (state.current.x - state.origin.x);
      const knobDy = (state.current.y - state.origin.y);
      const dist = Math.sqrt(knobDx * knobDx + knobDy * knobDy);
      const clampedDist = Math.min(dist, MAX_DIST);
      const ratio = dist > 0 ? clampedDist / dist : 0;

      return (
        <div
          style={{
            ...baseStyle,
            left: state.origin.x,
            top: state.origin.y,
          }}
        >
          <div
            style={{
              ...knobStyle,
              transform: `translate(calc(-50% + ${knobDx * ratio}px), calc(-50% + ${knobDy * ratio}px))`,
            }}
          />
        </div>
      );
    };

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 100,
          overflow: "hidden",
        }}
      >
        {renderJoystick(moveRef.current)}
        {renderJoystick(aimRef.current)}
      </div>
    );
  }, [isTouchDevice, movement, aim]);

  return {
    movement,
    aim,
    isTouchDevice,
    JoystickOverlay,
  };
}
