import type { Planet } from "./types";

/** 8 planets inspired by the solar system. */
const PLANET_CONFIGS: Omit<Planet, "x" | "y">[] = [
  { name: "Mercury", radius: 40, color: "#8c7e6d", surfaceDetails: "rocky", scrollSpeed: 0.15, parallaxDepth: 0.05 },
  { name: "Venus", radius: 65, color: "#d4a04a", surfaceDetails: "volcanic", scrollSpeed: 0.12, parallaxDepth: 0.08 },
  { name: "Earth", radius: 70, color: "#4488cc", surfaceDetails: "rocky", scrollSpeed: 0.10, parallaxDepth: 0.12 },
  { name: "Mars", radius: 55, color: "#c25a3a", surfaceDetails: "rocky", scrollSpeed: 0.18, parallaxDepth: 0.06 },
  { name: "Jupiter", radius: 150, color: "#c4a46a", surfaceDetails: "gas-bands", scrollSpeed: 0.06, parallaxDepth: 0.03 },
  { name: "Saturn", radius: 130, color: "#d4b876", surfaceDetails: "ringed", scrollSpeed: 0.05, parallaxDepth: 0.04 },
  { name: "Uranus", radius: 90, color: "#7ec8c8", surfaceDetails: "ice", scrollSpeed: 0.08, parallaxDepth: 0.07 },
  { name: "Neptune", radius: 85, color: "#3366cc", surfaceDetails: "ice", scrollSpeed: 0.07, parallaxDepth: 0.06 },
];

/** Pre-sorted by parallax depth (farthest first). */
const SORTED_CONFIGS = [...PLANET_CONFIGS].sort((a, b) => a.parallaxDepth - b.parallaxDepth);

/** Create planet instances positioned above the screen, stacked for scrolling. */
export function initPlanets(canvasW: number, canvasH: number): Planet[] {
  return SORTED_CONFIGS.map((cfg, i) => ({
    ...cfg,
    x: canvasW * 0.15 + (i % 4) * canvasW * 0.22,
    y: -cfg.radius * 2 - i * canvasH * 0.6,
  }));
}

/** Render all visible planets with parallax. */
export function renderPlanets(
  ctx: CanvasRenderingContext2D,
  planets: Planet[],
  cameraX: number,
  cameraY: number,
  canvasW: number,
  canvasH: number,
  time: number,
): void {
  // Planets are pre-sorted by parallaxDepth via initPlanets()
  for (const p of planets) {
    const scrollY = p.y + time * p.scrollSpeed * 60;
    const px = p.x - cameraX * p.parallaxDepth;
    const py = scrollY - cameraY * p.parallaxDepth;
    const pad = p.radius * 2;
    if (py + pad < -p.radius * 2 || py - pad > canvasH + p.radius * 2) continue;
    drawPlanet(ctx, p, px, py);
  }
}

function drawPlanet(ctx: CanvasRenderingContext2D, p: Planet, sx: number, sy: number): void {
  const { radius, color, surfaceDetails, name } = p;
  ctx.save();

  // Outer glow
  const glow = ctx.createRadialGradient(sx, sy, radius * 0.8, sx, sy, radius * 1.4);
  glow.addColorStop(0, `${color}33`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, radius * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Body gradient
  const bg = ctx.createRadialGradient(sx - radius * 0.3, sy - radius * 0.3, radius * 0.1, sx, sy, radius);
  bg.addColorStop(0, adjustColor(color, 40));
  bg.addColorStop(0.7, color);
  bg.addColorStop(1, adjustColor(color, -40));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Surface details
  ctx.globalAlpha = 0.3;
  if (surfaceDetails === "rocky") drawCraters(ctx, sx, sy, radius, name);
  else if (surfaceDetails === "gas-bands") drawGasBands(ctx, sx, sy, radius, color);
  else if (surfaceDetails === "ringed") { drawGasBands(ctx, sx, sy, radius, color); ctx.globalAlpha = 0.5; drawRings(ctx, sx, sy, radius, color); }
  else if (surfaceDetails === "ice") drawIceCaps(ctx, sx, sy, radius);
  else if (surfaceDetails === "volcanic") drawVolcanic(ctx, sx, sy, radius);
  ctx.globalAlpha = 1;

  // Atmospheric edge
  ctx.strokeStyle = `${adjustColor(color, 30)}44`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCraters(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: string): void {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const rng = (i: number) => Math.abs(Math.sin(hash + i * 127.1)) % 1;

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 8; i++) {
    const angle = rng(i) * Math.PI * 2;
    const dist = rng(i + 10) * r * 0.7;
    const cr = r * 0.08 + rng(i + 20) * r * 0.12;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath(); ctx.arc(x - cr * 0.3, y - cr * 0.3, cr * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawGasBands(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 8; i++) {
    const y = cy - r + (i / 8) * r * 2;
    ctx.fillStyle = i % 2 === 0 ? adjustColor(color, -15) : adjustColor(color, 10);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(cx - r, y, r * 2, r * 2 / 8);
  }
  ctx.restore();
}

function drawRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = adjustColor(color, 20 + i * 10);
    ctx.lineWidth = 4 - i;
    ctx.globalAlpha = 0.4 - i * 0.1;
    ctx.beginPath(); ctx.ellipse(0, 0, r * (1.3 + i * 0.15), r * (1.3 + i * 0.15) * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawIceCaps(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "rgba(220,240,255,0.4)";
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.7, r * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(200,230,255,0.3)";
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.75, r * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawVolcanic(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = "rgba(255,100,30,0.4)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3);
    ctx.quadraticCurveTo(cx + Math.cos(a + 0.4) * r * 0.6, cy + Math.sin(a + 0.4) * r * 0.7, cx + Math.cos(a + 0.8) * r * 0.8, cy + Math.sin(a + 0.8) * r * 0.8);
    ctx.stroke();
  }
  drawCraters(ctx, cx, cy, r, "Venus");
  ctx.restore();
}

function adjustColor(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
