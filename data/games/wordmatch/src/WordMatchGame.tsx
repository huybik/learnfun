"use client";

/**
 * 3D Crystal Word Match Game.
 * Ported from the old code with multiplayer-ready architecture.
 * Uses @react-three/fiber Canvas with icosahedron crystals as match items.
 * Game state synced via GameContext instead of direct AI calls.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Canvas,
  useFrame,
  type ThreeEvent,
  useThree,
  extend,
  useLoader,
} from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { useGameContext } from "@/modules/display/hooks/useGameState";

// ---- OrbitControls Setup ----
extend({ OrbitControls: OrbitControlsImpl });

const CameraControls = () => {
  const {
    camera,
    gl: { domElement },
  } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  useFrame(() => controlsRef.current?.update());
  return (
    // @ts-ignore — extend'd JSX element
    <orbitControls
      ref={controlsRef}
      args={[camera, domElement]}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
    />
  );
};

// ---- Stars Background ----
const CustomStars: React.FC<{
  count?: number;
  radius?: number;
  depth?: number;
  factor?: number;
  speed?: number;
}> = ({ count = 5000, radius = 100, depth = 50, factor = 4, speed = 1 }) => {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius + Math.random() * depth;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      arr.set(
        [
          r * Math.cos(theta) * Math.sin(phi),
          r * Math.sin(theta) * Math.sin(phi),
          r * Math.cos(phi),
        ],
        i * 3,
      );
    }
    return arr;
  }, [count, radius, depth]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= (delta * speed) / 10;
      ref.current.rotation.y -= (delta * speed) / 15;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={factor}
        color="white"
        sizeAttenuation
        depthWrite={false}
        transparent
        opacity={0.8}
      />
    </points>
  );
};

// ---- Particle Explosion ----
interface ParticleExplosionProps {
  position: THREE.Vector3;
  color: THREE.Color;
  count?: number;
  duration?: number;
  onComplete: () => void;
}

const ParticleExplosion: React.FC<ParticleExplosionProps> = ({
  position,
  color,
  count = 50,
  duration = 800,
  onComplete,
}) => {
  const pointsRef = useRef<THREE.Points>(null!);
  const materialRef = useRef<THREE.PointsMaterial>(null!);
  const { clock } = useThree();
  const startTime = useRef(clock.getElapsedTime());

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions.set([0, 0, 0], i * 3);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 1 + Math.random() * 3;
      velocities.set(
        [
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed,
        ],
        i * 3,
      );
    }
    return { positions, velocities };
  }, [count]);

  useFrame(() => {
    const elapsed = clock.getElapsedTime() - startTime.current;
    const progress = Math.min(1, elapsed / (duration / 1000));

    if (pointsRef.current && materialRef.current) {
      const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const vel = particles.velocities;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        pos[i3] = vel[i3] * progress * 1.5;
        pos[i3 + 1] = vel[i3 + 1] * progress * 1.5;
        pos[i3 + 2] = vel[i3 + 2] * progress * 1.5;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      materialRef.current.opacity = 1 - progress;
      materialRef.current.needsUpdate = true;
      if (progress >= 1) onComplete();
    }
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.08}
        color={color}
        sizeAttenuation
        transparent
        opacity={1}
        depthWrite={false}
      />
    </points>
  );
};

// ---- Types ----
interface MatchItem {
  id: number | string;
  value: string;
  image_data?: string;
  source_coordinates?: { x_min: number; y_min: number; x_max: number; y_max: number };
  pairId: number | string;
  position: [number, number, number];
  matched: boolean;
  baseColor: THREE.Color;
}

// ---- Constants ----
const CRYSTAL_GEOMETRY_TEXT = new THREE.IcosahedronGeometry(1.0, 0);
const CRYSTAL_GEOMETRY_IMAGE = new THREE.IcosahedronGeometry(1.2, 0);
const IMAGE_PLANE_SIZE = 2.2;
const CAMERA_DISTANCE = 8;
const CAMERA_FOV = 60;

// ---- Crystal Image/Text ----
const CrystalImage: React.FC<{ imageUrl: string; scale: [number, number] }> = ({
  imageUrl,
  scale,
}) => {
  const texture = useLoader(THREE.TextureLoader, imageUrl);
  return (
    <mesh position={[0, 0, 1.25]} scale={[scale[0], scale[1], 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
};

const CrystalText: React.FC<{ text: string }> = ({ text }) => {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d")!;
    const font = "bold 48px sans-serif";
    const outline = 5;
    ctx.font = font;
    const m = ctx.measureText(text);
    c.width = m.width + outline * 2;
    c.height = 48 + outline * 2;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = outline;
    ctx.strokeStyle = "black";
    ctx.strokeText(text, c.width / 2, c.height / 2);
    ctx.fillStyle = "white";
    ctx.fillText(text, c.width / 2, c.height / 2);
    return c;
  }, [text]);

  return (
    <mesh position={[0, 0, 1.05]}>
      <planeGeometry args={[canvas.width / 100, canvas.height / 100]} />
      <meshBasicMaterial transparent>
        <canvasTexture attach="map" image={canvas} />
      </meshBasicMaterial>
    </mesh>
  );
};

// ---- Crystal Component ----
const Crystal = React.memo(
  ({
    item,
    onClick,
    isSelected,
    isMatched,
  }: {
    item: MatchItem;
    onClick: (item: MatchItem) => void;
    isSelected: boolean;
    isMatched: boolean;
  }) => {
    const groupRef = useRef<THREE.Group>(null!);
    const meshRef = useRef<THREE.Mesh>(null!);
    const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

    const isImage = !!item.image_data;
    const geometry = isImage ? CRYSTAL_GEOMETRY_IMAGE : CRYSTAL_GEOMETRY_TEXT;
    const baseColor = item.baseColor;
    const hoverColor = useMemo(() => baseColor.clone().offsetHSL(0, 0.1, 0.1), [baseColor]);
    const [isHovered, setIsHovered] = useState(false);
    const [imageScale, setImageScale] = useState<[number, number]>([IMAGE_PLANE_SIZE, IMAGE_PLANE_SIZE]);

    const currentScaleRef = useRef(1);
    const currentColorRef = useRef(new THREE.Color(item.baseColor));
    const currentEmissiveRef = useRef(0.1);

    useEffect(() => {
      currentColorRef.current.copy(item.baseColor);
      if (materialRef.current) {
        materialRef.current.color.copy(item.baseColor);
        materialRef.current.emissive.copy(item.baseColor);
      }
      currentScaleRef.current = 1;
      currentEmissiveRef.current = 0.1;
    }, [item.baseColor]);

    useEffect(() => {
      if (item.image_data) {
        const img = new window.Image();
        img.onload = () => {
          const ratio = img.naturalWidth / img.naturalHeight;
          const sx = ratio > 1 ? IMAGE_PLANE_SIZE : IMAGE_PLANE_SIZE * ratio;
          const sy = ratio > 1 ? IMAGE_PLANE_SIZE / ratio : IMAGE_PLANE_SIZE;
          setImageScale([sx, sy]);
        };
        img.onerror = () => setImageScale([IMAGE_PLANE_SIZE, IMAGE_PLANE_SIZE]);
        img.src = `data:image/jpeg;base64,${item.image_data}`;
      }
    }, [item.image_data]);

    useFrame((_, delta) => {
      if (!groupRef.current || !meshRef.current || !materialRef.current) return;

      const targetScale = isSelected ? 1.3 : isHovered ? 1.1 : 1;
      const targetColor = isSelected || isHovered ? hoverColor : baseColor;
      const targetEmissive = isSelected ? 0.6 : isHovered ? 0.3 : 0.1;
      const lerp = delta * 10;

      currentScaleRef.current = THREE.MathUtils.lerp(currentScaleRef.current, targetScale, lerp);
      groupRef.current.scale.setScalar(currentScaleRef.current);

      currentColorRef.current.lerp(targetColor, lerp);
      materialRef.current.color.copy(currentColorRef.current);
      materialRef.current.emissive.copy(currentColorRef.current);

      currentEmissiveRef.current = THREE.MathUtils.lerp(currentEmissiveRef.current, targetEmissive, lerp);
      materialRef.current.emissiveIntensity = currentEmissiveRef.current;

      if (!isSelected && !isMatched) {
        meshRef.current.rotation.y += delta * 0.3;
        meshRef.current.rotation.x += delta * 0.1;
      }
    });

    if (isMatched) return null;

    const imageUrl = item.image_data ? `data:image/jpeg;base64,${item.image_data}` : undefined;

    return (
      <group ref={groupRef} position={item.position}>
        <mesh
          ref={meshRef}
          geometry={geometry}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (!isMatched) onClick(item);
          }}
          onPointerOver={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (!isMatched) setIsHovered(true);
          }}
          onPointerOut={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            setIsHovered(false);
          }}
        >
          <meshStandardMaterial
            ref={materialRef}
            color={item.baseColor}
            emissive={item.baseColor}
            emissiveIntensity={0.1}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
        {imageUrl ? (
          <CrystalImage imageUrl={imageUrl} scale={imageScale} />
        ) : (
          <CrystalText text={item.value} />
        )}
      </group>
    );
  },
);
Crystal.displayName = "Crystal";

// ---- Main WordMatchGame ----
export const WordMatchGame: React.FC = () => {
  const { initialData, updateGameStateForAI, endGame } = useGameContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<MatchItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MatchItem | null>(null);
  const [score, setScore] = useState(0);
  const [pairsLeft, setPairsLeft] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Match the items!");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explosions, setExplosions] = useState<(ParticleExplosionProps & { id: string })[]>([]);
  const explosionIdCounter = useRef(0);

  // ---- Initialization ----
  useEffect(() => {
    try {
      setError(null);
      if (!initialData || !Array.isArray(initialData.pairs) || initialData.pairs.length === 0) {
        throw new Error("Invalid or missing 'pairs' data for WordMatch game.");
      }

      const pairs = initialData.pairs as unknown[];
      const subType = initialData.sub_type as string | undefined;
      const gameItems: MatchItem[] = [];

      const container = containerRef.current;
      const aspectRatio =
        container && container.clientHeight > 0
          ? container.clientWidth / container.clientHeight
          : typeof window !== "undefined" && window.innerHeight > 0
            ? window.innerWidth / window.innerHeight
            : 1;
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * CAMERA_DISTANCE;
      const halfWidth = halfHeight * aspectRatio;
      const maxH = Math.max(1.6, Math.min(halfWidth * 0.75, 3.5));
      const minH = maxH * 0.55;
      const range = Math.max(maxH - minH, 0);
      const maxV = Math.max(1.1, Math.min(halfHeight * 0.6, maxH * 0.8));

      if (subType === "WordToWord") {
        (pairs as string[][]).forEach((pair, i) => {
          if (!Array.isArray(pair) || pair.length !== 2) return;
          const pid = i + 1;
          gameItems.push({
            value: pair[0], id: `${pid}-1`, pairId: pid, position: [0, 0, 0], matched: false,
            baseColor: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
          });
          gameItems.push({
            value: pair[1], id: `${pid}-2`, pairId: pid, position: [0, 0, 0], matched: false,
            baseColor: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
          });
        });
      } else {
        (pairs as Record<string, unknown>[]).forEach((pair) => {
          const p = pair as Record<string, Record<string, string>>;
          const item2 = p.item2;
          if (!pair.id || !p.item1?.value || !(item2?.value || item2?.image_data)) return;
          gameItems.push({
            value: p.item1.value, image_data: p.item1.image_data,
            id: `${pair.id}-1`, pairId: pair.id as string, position: [0, 0, 0], matched: false,
            baseColor: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
          });
          gameItems.push({
            value: item2.value, image_data: item2.image_data,
            id: `${pair.id}-2`, pairId: pair.id as string, position: [0, 0, 0], matched: false,
            baseColor: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
          });
        });
      }

      // Shuffle and distribute positions
      gameItems.sort(() => Math.random() - 0.5);
      gameItems.forEach((item, index) => {
        const angle = (index / gameItems.length) * Math.PI * 2;
        const r = minH + range * (range > 0 ? Math.random() : 0.5);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * Math.min(r * 0.75, maxV);
        const z = (Math.random() - 0.5) * 1.5;
        item.position = [x, y, z];
      });

      const validPairs = gameItems.length / 2;
      if (validPairs === 0) throw new Error("No valid pairs for the game.");

      setItems(gameItems);
      setScore(0);
      setPairsLeft(validPairs);
      setSelectedItem(null);
      setStatusMessage("Match the items!");
      setIsProcessing(false);
      setExplosions([]);
      updateGameStateForAI({ message: "WordMatch game running.", status: "playing", score: 0, pairsLeft: validPairs });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Initialization failed: ${msg}`);
      updateGameStateForAI({ status: "error", message: `Init failed: ${msg}` });
    }
  }, [initialData, updateGameStateForAI]);

  const addExplosion = useCallback((position: [number, number, number], color: THREE.Color) => {
    const id = `exp-${explosionIdCounter.current++}`;
    setExplosions((prev) => [
      ...prev,
      {
        id,
        position: new THREE.Vector3(...position),
        color,
        onComplete: () => setExplosions((p) => p.filter((e) => e.id !== id)),
      },
    ]);
  }, []);

  const handleCrystalClick = useCallback(
    (clicked: MatchItem) => {
      if (isProcessing || clicked.matched || clicked.id === selectedItem?.id) return;

      const display = clicked.image_data ? `Image(${clicked.value})` : clicked.value;

      if (!selectedItem) {
        setSelectedItem(clicked);
        setStatusMessage(`Selected: ${display}`);
        return;
      }

      setIsProcessing(true);
      const selDisplay = selectedItem.image_data ? `Image(${selectedItem.value})` : selectedItem.value;

      if (selectedItem.pairId === clicked.pairId) {
        const newScore = score + 10;
        const newPairs = pairsLeft - 1;
        setScore(newScore);
        setPairsLeft(newPairs);
        setStatusMessage("Correct Match!");
        addExplosion(selectedItem.position, selectedItem.baseColor);
        addExplosion(clicked.position, clicked.baseColor);
        setItems((prev) =>
          prev.map((it) => (it.pairId === clicked.pairId ? { ...it, matched: true } : it)),
        );
        updateGameStateForAI({
          score: newScore, pairsLeft: newPairs, status: "playing",
          message: `Correct: ${selDisplay} & ${display}. Score: ${newScore}.`,
          lastAction: "match_correct",
        });

        if (newPairs === 0) {
          setStatusMessage("You matched them all!");
          setTimeout(() => {
            updateGameStateForAI({ score: newScore, pairsLeft: 0, status: "won", lastAction: "game_won" });
            endGame({ finalScore: newScore, outcome: "completed" });
          }, 1500);
        } else {
          setTimeout(() => { setSelectedItem(null); setIsProcessing(false); setStatusMessage("Match the items!"); }, 300);
        }
      } else {
        const newScore = Math.max(0, score - 5);
        setScore(newScore);
        setStatusMessage("Incorrect. Try again.");
        updateGameStateForAI({
          score: newScore, pairsLeft, status: "playing",
          message: `Incorrect: ${selDisplay} & ${display}. Score: ${newScore}.`,
          lastAction: "match_incorrect",
        });
        setTimeout(() => { setSelectedItem(null); setIsProcessing(false); setStatusMessage("Match the items!"); }, 1000);
      }
    },
    [selectedItem, score, pairsLeft, isProcessing, updateGameStateForAI, endGame, addExplosion],
  );

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-neutral-900 text-white">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={() => endGame({ outcome: "failed", reason: error })}
          className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-700"
        >
          Exit Game
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Canvas camera={{ position: [0, 0, CAMERA_DISTANCE], fov: CAMERA_FOV }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <CustomStars radius={100} depth={50} count={5000} factor={4} speed={1} />
        {items.map((item) => (
          <Crystal
            key={item.id}
            item={item}
            onClick={handleCrystalClick}
            isSelected={selectedItem?.id === item.id}
            isMatched={item.matched}
          />
        ))}
        {explosions.map((exp) => (
          <ParticleExplosion key={exp.id} {...exp} />
        ))}
        <CameraControls />
      </Canvas>

      {/* HUD overlay */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between p-4 text-white">
        <div className="rounded-lg bg-black/50 px-3 py-1.5 text-sm backdrop-blur">
          Score: <span className="font-bold">{score}</span>
        </div>
        <div className="rounded-lg bg-black/50 px-3 py-1.5 text-sm backdrop-blur">
          Pairs Left: <span className="font-bold">{pairsLeft}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center p-4">
        <div className="rounded-lg bg-black/50 px-4 py-2 text-sm text-white backdrop-blur">
          {statusMessage}
        </div>
      </div>
    </div>
  );
};
