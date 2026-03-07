"use client";

/**
 * ProceduralPlanet — a React Three Fiber component that renders beautiful
 * procedural planet meshes using custom GLSL shaders.
 * Supports star, rocky, gas giant, and ice giant surface types.
 */

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlanetData } from "./planet-data";

// ---- GLSL Noise (Simplex 3D) ----
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
`;

// ---- Vertex Shader (shared) ----
const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ---- Star Fragment Shader ----
const STAR_FRAGMENT = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uSecondaryColor;
uniform float uNoiseScale;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 pos = vPosition * uNoiseScale;

  // Animated plasma with multiple layers
  float n1 = fbm(pos + uTime * 0.15, 4);
  float n2 = fbm(pos * 1.5 - uTime * 0.1, 3);
  float n3 = snoise(pos * 2.0 + vec3(uTime * 0.2, 0.0, uTime * 0.1));

  // Convection cells
  float cells = abs(snoise(pos * 3.0 + uTime * 0.05));

  float plasma = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  plasma = plasma * 0.5 + 0.5; // normalize to 0-1

  // Color mixing
  vec3 hotColor = vec3(1.0, 0.95, 0.7);
  vec3 color = mix(uSecondaryColor, uBaseColor, plasma);
  color = mix(color, hotColor, cells * 0.3);

  // Bright spots (solar flares)
  float flare = smoothstep(0.65, 0.85, plasma + cells * 0.3);
  color += hotColor * flare * 0.5;

  // Emissive glow
  gl_FragColor = vec4(color, 1.0);
}
`;

// ---- Rocky Fragment Shader ----
const ROCKY_FRAGMENT = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uSecondaryColor;
uniform float uNoiseScale;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 pos = vPosition * uNoiseScale;

  // Multi-octave terrain
  float terrain = fbm(pos, 5);
  float detail = snoise(pos * 4.0) * 0.15;
  float craters = 1.0 - smoothstep(0.0, 0.15, abs(snoise(pos * 6.0) - 0.3));

  float height = terrain + detail;

  // Color based on height
  vec3 color = mix(uSecondaryColor, uBaseColor, height * 0.5 + 0.5);

  // Darken craters
  color = mix(color, uSecondaryColor * 0.5, craters * 0.4);

  // Simple diffuse lighting
  vec3 lightDir = normalize(vec3(-1.0, 0.5, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);

  // Bump effect via noise gradient
  float bump = snoise(pos * uNoiseScale * 1.5) * 0.05;
  diff = max(diff + bump, 0.15);

  color *= 0.3 + diff * 0.7;

  gl_FragColor = vec4(color, 1.0);
}
`;

// ---- Gas Giant Fragment Shader ----
const GAS_FRAGMENT = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uSecondaryColor;
uniform float uNoiseScale;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Horizontal bands based on latitude
  float lat = vPosition.y * uNoiseScale;

  // Domain warping for swirling effect
  float warp = snoise(vec3(lat * 2.0, vPosition.x * 2.0, uTime * 0.08)) * 0.5;
  float warp2 = snoise(vec3(lat * 0.8 + warp, vPosition.z * 1.5, uTime * 0.05)) * 0.3;

  // Band pattern
  float bands = sin(lat * 8.0 + warp + warp2) * 0.5 + 0.5;
  float fineBands = sin(lat * 20.0 + warp * 2.0) * 0.5 + 0.5;
  bands = mix(bands, fineBands, 0.3);

  // Storm spots
  float storm = smoothstep(0.7, 0.9,
    snoise(vec3(vPosition.x * 3.0, vPosition.y * 2.0 - uTime * 0.02, vPosition.z * 3.0))
  );

  // Color mixing
  vec3 color = mix(uSecondaryColor, uBaseColor, bands);

  // Lighter and darker band accents
  vec3 lightBand = uBaseColor * 1.2;
  vec3 darkBand = uSecondaryColor * 0.7;
  float accent = sin(lat * 12.0 + warp) * 0.5 + 0.5;
  color = mix(color, mix(darkBand, lightBand, accent), 0.2);

  // Storm coloring
  vec3 stormColor = mix(uSecondaryColor * 0.8, vec3(0.8, 0.3, 0.2), 0.5);
  color = mix(color, stormColor, storm * 0.6);

  // Lighting
  vec3 lightDir = normalize(vec3(-1.0, 0.3, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  color *= 0.4 + diff * 0.6;

  gl_FragColor = vec4(color, 1.0);
}
`;

// ---- Ice Giant Fragment Shader ----
const ICE_FRAGMENT = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uSecondaryColor;
uniform float uNoiseScale;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 pos = vPosition * uNoiseScale;

  // Smooth icy surface with subtle variation
  float n1 = fbm(pos + uTime * 0.02, 3) * 0.5 + 0.5;
  float n2 = snoise(pos * 2.0 + uTime * 0.03) * 0.5 + 0.5;

  // Subtle banding (less pronounced than gas giants)
  float band = sin(vPosition.y * 4.0 + snoise(pos * 0.5) * 1.5) * 0.5 + 0.5;

  // Color mixing
  vec3 color = mix(uSecondaryColor, uBaseColor, n1);
  color = mix(color, uBaseColor * 1.15, band * 0.2);

  // Icy shimmer
  float shimmer = snoise(pos * 8.0 + uTime * 0.1) * 0.1;
  color += vec3(shimmer * 0.3, shimmer * 0.4, shimmer * 0.5);

  // Lighting with strong fresnel for atmosphere haze
  vec3 lightDir = normalize(vec3(-1.0, 0.3, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  color *= 0.35 + diff * 0.65;

  gl_FragColor = vec4(color, 1.0);
}
`;

// ---- Helper: choose shader by surface type ----
function getFragmentShader(type: string): string {
  switch (type) {
    case "star":
      return STAR_FRAGMENT;
    case "gas":
      return GAS_FRAGMENT;
    case "ice":
      return ICE_FRAGMENT;
    default:
      return ROCKY_FRAGMENT;
  }
}

// ---- Atmosphere Glow Component ----
const ATMO_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPos.xyz);
  gl_Position = projectionMatrix * mvPos;
}
`;

const ATMO_FRAGMENT = /* glsl */ `
uniform vec3 uAtmoColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float fresnel = 1.0 - dot(vNormal, vViewDir);
  fresnel = pow(fresnel, 3.0) * uIntensity;
  gl_FragColor = vec4(uAtmoColor, fresnel * 0.6);
}
`;

const Atmosphere: React.FC<{ color: string; radius: number }> = ({
  color,
  radius,
}) => {
  const uniforms = useMemo(
    () => ({
      uAtmoColor: { value: new THREE.Color(color) },
      uIntensity: { value: 1.5 },
    }),
    [color]
  );

  return (
    <mesh scale={radius * 1.15}>
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial
        vertexShader={ATMO_VERTEX}
        fragmentShader={ATMO_FRAGMENT}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ---- Sun Corona ----
const SUN_CORONA_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float fresnel = 1.0 - dot(vNormal, vViewDir);
  fresnel = pow(fresnel, 2.0);
  float pulse = 0.8 + 0.2 * sin(uTime * 2.0);
  gl_FragColor = vec4(uColor, fresnel * 0.4 * pulse);
}
`;

const SunCorona: React.FC<{ radius: number }> = ({ radius }) => {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#FFA500") },
      uTime: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh scale={radius * 1.3}>
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial
        vertexShader={ATMO_VERTEX}
        fragmentShader={SUN_CORONA_FRAGMENT}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ---- Ring Component ----
const RING_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RING_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;

void main() {
  // Radial distance from center of ring UV
  float dist = length(vUv - 0.5) * 2.0;

  // Ring bands
  float band = sin(dist * 40.0) * 0.5 + 0.5;
  float alpha = smoothstep(0.0, 0.1, dist) * smoothstep(1.0, 0.8, dist);
  alpha *= 0.5 + band * 0.3;

  gl_FragColor = vec4(uColor, alpha * 0.6);
}
`;

const PlanetRings: React.FC<{
  innerRadius: number;
  outerRadius: number;
  color: string;
}> = ({ innerRadius, outerRadius, color }) => {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
    }),
    [color]
  );

  return (
    <mesh rotation={[-Math.PI * 0.4, 0, 0]}>
      <ringGeometry args={[innerRadius, outerRadius, 64]} />
      <shaderMaterial
        vertexShader={RING_VERTEX}
        fragmentShader={RING_FRAGMENT}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ---- Main ProceduralPlanet Component ----
interface ProceduralPlanetProps {
  planetData: PlanetData;
  scale?: number;
  onClick?: () => void;
  isHighlighted?: boolean;
  position?: [number, number, number];
}

export const ProceduralPlanet: React.FC<ProceduralPlanetProps> = ({
  planetData,
  scale = 1,
  onClick,
  isHighlighted = false,
  position = [0, 0, 0],
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const highlightRef = useRef<THREE.Mesh>(null!);

  const { surfaceFeatures, radius, atmosphere, hasRings, ringColor, ringInnerRadius, ringOuterRadius } = planetData;
  const isStar = surfaceFeatures.type === "star";

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(...surfaceFeatures.baseColor) },
      uSecondaryColor: {
        value: new THREE.Color(
          ...(surfaceFeatures.secondaryColor ?? surfaceFeatures.baseColor)
        ),
      },
      uNoiseScale: { value: surfaceFeatures.noiseScale },
    }),
    [surfaceFeatures]
  );

  const fragmentShader = useMemo(
    () => getFragmentShader(surfaceFeatures.type),
    [surfaceFeatures.type]
  );

  // Animation
  useFrame(({ clock }, delta) => {
    uniforms.uTime.value = clock.getElapsedTime();

    if (meshRef.current) {
      meshRef.current.rotation.y += delta * planetData.rotationSpeed * 0.3;
    }

    // Highlight pulse
    if (highlightRef.current) {
      const targetOpacity = isHighlighted ? 0.15 + Math.sin(clock.getElapsedTime() * 3) * 0.08 : 0;
      const mat = highlightRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, delta * 5);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Main planet sphere */}
      <mesh
        ref={meshRef}
        onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
        onPointerOver={onClick ? (e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; } : undefined}
        onPointerOut={onClick ? () => { document.body.style.cursor = "auto"; } : undefined}
      >
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          vertexShader={VERTEX_SHADER}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>

      {/* Selection highlight ring */}
      <mesh ref={highlightRef} scale={radius * 1.25}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#60A5FA"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Atmosphere */}
      {atmosphere && <Atmosphere color={atmosphere} radius={radius} />}

      {/* Sun corona */}
      {isStar && <SunCorona radius={radius} />}

      {/* Sun light emission */}
      {isStar && <pointLight intensity={3} distance={100} decay={0.5} color="#FDB813" />}

      {/* Rings */}
      {hasRings && ringColor && ringInnerRadius && ringOuterRadius && (
        <PlanetRings
          innerRadius={ringInnerRadius}
          outerRadius={ringOuterRadius}
          color={ringColor}
        />
      )}
    </group>
  );
};
