"use client";

/**
 * SolarSystemScene — main Three.js scene with the full solar system.
 * Handles camera transitions, orbit animations, starfield, and asteroid belt.
 */

import React, { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ProceduralPlanet } from "./ProceduralPlanet";
import { PLANET_DATA, PLANETS_ONLY, type PlanetData } from "./planet-data";

// ---- Constants ----
const OVERVIEW_POSITION = new THREE.Vector3(0, 35, 55);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const CAMERA_LERP_SPEED = 2.0;

// ---- Starfield ----
const Starfield: React.FC<{ count?: number }> = ({ count = 3000 }) => {
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 150 + Math.random() * 200;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.cos(theta) * Math.sin(phi);
      arr[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = 0.5 + Math.random() * 2.0;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.003;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={1.5}
        color="#ffffff"
        sizeAttenuation
        depthWrite={false}
        transparent
        opacity={0.7}
      />
    </points>
  );
};

// ---- Asteroid Belt ----
const AsteroidBelt: React.FC = () => {
  const ref = useRef<THREE.Points>(null!);
  const count = 600;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Between Mars (15.5) and Jupiter (22) orbit radii
      const r = 17 + Math.random() * 4;
      const y = (Math.random() - 0.5) * 1.0;
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.005;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#887766"
        sizeAttenuation
        depthWrite={false}
        transparent
        opacity={0.6}
      />
    </points>
  );
};

// ---- Space Dust ----
const SpaceDust: React.FC = () => {
  const ref = useRef<THREE.Points>(null!);
  const count = 200;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 100;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.002;
      ref.current.rotation.x += delta * 0.001;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.3}
        color="#554488"
        sizeAttenuation
        depthWrite={false}
        transparent
        opacity={0.25}
      />
    </points>
  );
};

// ---- Orbital Path ----
const OrbitPath: React.FC<{ radius: number }> = ({ radius }) => {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return pts;
  }, [radius]);

  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#ffffff" transparent opacity={0.08} />
    </line>
  );
};

// ---- Orbiting Planet Wrapper ----
const OrbitingPlanet: React.FC<{
  planetData: PlanetData;
  onSelect: (name: string) => void;
  selectedPlanet: string | null;
  orbitAngleRef: React.MutableRefObject<Record<string, number>>;
}> = ({ planetData, onSelect, selectedPlanet, orbitAngleRef }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const isSelected = selectedPlanet === planetData.name;

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Update orbit angle
    const currentAngle = orbitAngleRef.current[planetData.name] ?? Math.random() * Math.PI * 2;
    const newAngle = currentAngle + delta * planetData.orbitSpeed;
    orbitAngleRef.current[planetData.name] = newAngle;

    // Set position along orbit
    const x = Math.cos(newAngle) * planetData.orbitRadius;
    const z = Math.sin(newAngle) * planetData.orbitRadius;
    groupRef.current.position.set(x, 0, z);
  });

  return (
    <group ref={groupRef}>
      <ProceduralPlanet
        planetData={planetData}
        onClick={() => onSelect(planetData.name)}
        isHighlighted={isSelected}
      />
    </group>
  );
};

// ---- Camera Controller ----
interface CameraControllerProps {
  targetPlanet: string | null;
  orbitAngleRef: React.MutableRefObject<Record<string, number>>;
  onTransitionComplete?: () => void;
}

const CameraController: React.FC<CameraControllerProps> = ({
  targetPlanet,
  orbitAngleRef,
  onTransitionComplete,
}) => {
  const { camera } = useThree();
  const targetPos = useRef(OVERVIEW_POSITION.clone());
  const targetLook = useRef(OVERVIEW_TARGET.clone());
  const currentLook = useRef(OVERVIEW_TARGET.clone());
  const transitionDone = useRef(true);
  const prevTarget = useRef<string | null>(null);

  useFrame((_, delta) => {
    // Reset transition tracking only when the target actually changes
    if (targetPlanet !== prevTarget.current) {
      prevTarget.current = targetPlanet;
      transitionDone.current = false;
    }

    if (targetPlanet) {
      const planet = PLANET_DATA.find((p) => p.name === targetPlanet);
      if (planet && planet.orbitRadius > 0) {
        const angle = orbitAngleRef.current[planet.name] ?? 0;
        const px = Math.cos(angle) * planet.orbitRadius;
        const pz = Math.sin(angle) * planet.orbitRadius;
        const viewDist = planet.radius * 4 + 2;

        targetPos.current.set(px + viewDist * 0.5, viewDist * 0.4, pz + viewDist * 0.7);
        targetLook.current.set(px, 0, pz);
      } else if (planet) {
        // Sun
        const viewDist = planet.radius * 3 + 3;
        targetPos.current.set(viewDist, viewDist * 0.4, viewDist);
        targetLook.current.set(0, 0, 0);
      }
    } else {
      targetPos.current.copy(OVERVIEW_POSITION);
      targetLook.current.copy(OVERVIEW_TARGET);
    }

    // Smooth camera movement
    const lerpFactor = 1 - Math.exp(-CAMERA_LERP_SPEED * delta);
    camera.position.lerp(targetPos.current, lerpFactor);
    currentLook.current.lerp(targetLook.current, lerpFactor);
    camera.lookAt(currentLook.current);

    // Check transition completion
    if (!transitionDone.current) {
      const dist = camera.position.distanceTo(targetPos.current);
      if (dist < 0.1) {
        transitionDone.current = true;
        onTransitionComplete?.();
      }
    }
  });

  return null;
};

// ---- Planet Name Label ----
const PlanetLabel: React.FC<{
  planetData: PlanetData;
  orbitAngleRef: React.MutableRefObject<Record<string, number>>;
  isSelected: boolean;
}> = ({ planetData, orbitAngleRef, isSelected }) => {
  const ref = useRef<THREE.Sprite>(null!);
  const prevTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const texture = useMemo(() => {
    if (prevTextureRef.current) {
      prevTextureRef.current.dispose();
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const fontSize = 32;
    ctx.font = `bold ${fontSize}px sans-serif`;
    const metrics = ctx.measureText(planetData.name);
    canvas.width = metrics.width + 20;
    canvas.height = fontSize + 10;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = isSelected ? "#60A5FA" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(planetData.name, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    prevTextureRef.current = tex;
    return tex;
  }, [planetData.name, isSelected]);

  useEffect(() => {
    return () => {
      if (prevTextureRef.current) {
        prevTextureRef.current.dispose();
      }
    };
  }, []);

  useFrame(() => {
    if (!ref.current) return;
    if (planetData.orbitRadius === 0) {
      ref.current.position.set(0, planetData.radius + 1.5, 0);
    } else {
      const angle = orbitAngleRef.current[planetData.name] ?? 0;
      const x = Math.cos(angle) * planetData.orbitRadius;
      const z = Math.sin(angle) * planetData.orbitRadius;
      ref.current.position.set(x, planetData.radius + 0.8, z);
    }
  });

  return (
    <sprite ref={ref} scale={[2.5, 0.6, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} opacity={0.85} />
    </sprite>
  );
};

// ---- Main Scene (inner, runs inside Canvas) ----
interface SceneInnerProps {
  selectedPlanet: string | null;
  onSelectPlanet: (name: string | null) => void;
  onTransitionComplete?: () => void;
}

const SceneInner: React.FC<SceneInnerProps> = ({
  selectedPlanet,
  onSelectPlanet,
  onTransitionComplete,
}) => {
  const orbitAngleRef = useRef<Record<string, number>>({});

  const handleSelect = useCallback(
    (name: string) => {
      onSelectPlanet(selectedPlanet === name ? null : name);
    },
    [selectedPlanet, onSelectPlanet]
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />

      {/* Camera */}
      <CameraController
        targetPlanet={selectedPlanet}
        orbitAngleRef={orbitAngleRef}
        onTransitionComplete={onTransitionComplete}
      />

      {/* Background */}
      <Starfield />
      <SpaceDust />
      <AsteroidBelt />

      {/* Sun (static at center) */}
      <ProceduralPlanet
        planetData={PLANET_DATA[0]}
        onClick={() => handleSelect("Sun")}
        isHighlighted={selectedPlanet === "Sun"}
      />

      {/* Orbit paths */}
      {PLANETS_ONLY.map((p) => (
        <OrbitPath key={`orbit-${p.name}`} radius={p.orbitRadius} />
      ))}

      {/* Planets */}
      {PLANETS_ONLY.map((p) => (
        <OrbitingPlanet
          key={p.name}
          planetData={p}
          onSelect={handleSelect}
          selectedPlanet={selectedPlanet}
          orbitAngleRef={orbitAngleRef}
        />
      ))}

      {/* Labels */}
      {PLANET_DATA.map((p) => (
        <PlanetLabel
          key={`label-${p.name}`}
          planetData={p}
          orbitAngleRef={orbitAngleRef}
          isSelected={selectedPlanet === p.name}
        />
      ))}
    </>
  );
};

// ---- Exported Scene Component ----
export interface SolarSystemSceneProps {
  selectedPlanet: string | null;
  onSelectPlanet: (name: string | null) => void;
  onTransitionComplete?: () => void;
}

export const SolarSystemScene: React.FC<SolarSystemSceneProps> = ({
  selectedPlanet,
  onSelectPlanet,
  onTransitionComplete,
}) => {
  return (
    <Canvas
      camera={{ position: [0, 35, 55], fov: 50, near: 0.1, far: 500 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: "#000005" }}
    >
      <SceneInner
        selectedPlanet={selectedPlanet}
        onSelectPlanet={onSelectPlanet}
        onTransitionComplete={onTransitionComplete}
      />
    </Canvas>
  );
};
