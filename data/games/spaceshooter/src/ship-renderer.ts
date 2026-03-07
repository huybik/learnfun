import type { Ship, Enemy, Bullet, PowerUp } from "./types";

// ---- Player Ship ----

export function drawPlayerShip(ctx: CanvasRenderingContext2D, ship: Ship, time: number): void {
  if (!ship.active) return;
  const { x: sx, y: sy } = ship.position;
  const rot = ship.rotation;
  const size = 18 * ship.scale;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rot);

  if (ship.invulnerable && Math.floor(time * 10) % 2 === 0) ctx.globalAlpha = 0.4;

  drawEngineThrust(ctx, size, time);

  // Outer glow
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 15;
  drawShipShape(ctx, size, "#00ccff");

  // Inner body
  ctx.shadowBlur = 5;
  drawShipShape(ctx, size * 0.85, "#00eeff");

  // Core
  ctx.shadowBlur = 0;
  drawShipShape(ctx, size * 0.5, "#aaffff");

  // Cockpit
  ctx.fillStyle = "#ffffff88";
  ctx.beginPath();
  ctx.arc(size * 0.15, 0, size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  if (ship.shield > 0) drawShield(ctx, size, time);
  ctx.restore();
}

function drawShipShape(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, -size * 0.5);
  ctx.lineTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.7, size * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawEngineThrust(ctx: CanvasRenderingContext2D, size: number, time: number): void {
  const flicker = 0.7 + Math.sin(time * 30) * 0.3;
  const len = size * 0.6 * flicker;

  ctx.fillStyle = "#0066ff88";
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.2);
  ctx.lineTo(-size * 0.3 - len * 1.3, 0);
  ctx.lineTo(-size * 0.3, size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#44ccffcc";
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.1);
  ctx.lineTo(-size * 0.3 - len, 0);
  ctx.lineTo(-size * 0.3, size * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffffaa";
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.05);
  ctx.lineTo(-size * 0.3 - len * 0.5, 0);
  ctx.lineTo(-size * 0.3, size * 0.05);
  ctx.closePath();
  ctx.fill();
}

function drawShield(ctx: CanvasRenderingContext2D, size: number, time: number): void {
  const pulse = 0.6 + Math.sin(time * 4) * 0.15;
  const r = size * 1.5;
  ctx.strokeStyle = `rgba(100,200,255,${pulse * 0.6})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(150,230,255,${pulse * 0.3})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
  ctx.stroke();
}

// ---- Enemy ----

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, time: number): void {
  if (!enemy.active) return;
  const { x: sx, y: sy } = enemy.position;
  const size = enemySize(enemy.enemyType);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(enemy.rotation);

  if (enemy.telegraphing) {
    ctx.globalAlpha = 0.5 + Math.sin(time * 20) * 0.5 * 0.5 + 0.25;
  }

  const color = enemyColor(enemy.enemyType);
  ctx.shadowColor = enemyGlow(enemy.enemyType);
  ctx.shadowBlur = 10;

  switch (enemy.enemyType) {
    case "scout": drawScout(ctx, size, color); break;
    case "fighter": drawFighter(ctx, size, color); break;
    case "bomber": drawBomber(ctx, size, color); break;
    case "boss": drawBoss(ctx, size, color, time); break;
  }

  ctx.shadowBlur = 0;
  if (enemy.health < enemy.maxHealth || enemy.enemyType === "boss") {
    drawHealthBar(ctx, enemy.health / enemy.maxHealth, size);
  }
  ctx.restore();
}

function enemySize(t: string): number {
  return t === "scout" ? 12 : t === "fighter" ? 16 : t === "bomber" ? 22 : t === "boss" ? 45 : 14;
}
function enemyColor(t: string): string {
  return t === "scout" ? "#ff6644" : t === "fighter" ? "#ff4422" : t === "bomber" ? "#cc3300" : "#ff2200";
}
function enemyGlow(t: string): string {
  return t === "scout" ? "#ff8844" : t === "fighter" ? "#ff4422" : t === "bomber" ? "#ff6600" : "#ff0000";
}

function drawScout(ctx: CanvasRenderingContext2D, s: number, c: string): void {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(s, 0); ctx.lineTo(0, -s * 0.5); ctx.lineTo(-s * 0.6, 0); ctx.lineTo(0, s * 0.5);
  ctx.closePath(); ctx.fill();
}

function drawFighter(ctx: CanvasRenderingContext2D, s: number, c: string): void {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(s, 0); ctx.lineTo(-s * 0.5, -s * 0.6); ctx.lineTo(-s * 0.2, 0); ctx.lineTo(-s * 0.5, s * 0.6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ff8866";
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, dir * s * 0.4);
    ctx.lineTo(-s * 0.8, dir * s * 0.7);
    ctx.lineTo(-s * 0.5, dir * s * 0.3);
    ctx.closePath(); ctx.fill();
  }
}

function drawBomber(ctx: CanvasRenderingContext2D, s: number, c: string): void {
  ctx.fillStyle = c;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
    fn.call(ctx, Math.cos(a) * s, Math.sin(a) * s * 0.8);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffaa00";
  ctx.beginPath(); ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2); ctx.fill();
}

function drawBoss(ctx: CanvasRenderingContext2D, s: number, c: string, time: number): void {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(s, 0); ctx.lineTo(s * 0.3, -s * 0.7); ctx.lineTo(-s * 0.5, -s * 0.8);
  ctx.lineTo(-s * 0.8, -s * 0.3); ctx.lineTo(-s * 0.8, s * 0.3);
  ctx.lineTo(-s * 0.5, s * 0.8); ctx.lineTo(s * 0.3, s * 0.7);
  ctx.closePath(); ctx.fill();

  const pulse = 0.8 + Math.sin(time * 3) * 0.2;
  ctx.fillStyle = `rgba(255,100,0,${pulse})`;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(s * 0.2, 0, s * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f00";
  ctx.beginPath(); ctx.arc(s * 0.22, 0, s * 0.06, 0, Math.PI * 2); ctx.fill();
}

function drawHealthBar(ctx: CanvasRenderingContext2D, pct: number, size: number): void {
  const w = size * 2, h = 3, x = -w / 2, y = -size - 8;
  ctx.fillStyle = "#333"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pct > 0.5 ? "#44ff44" : pct > 0.25 ? "#ffaa00" : "#ff3333";
  ctx.fillRect(x, y, w * pct, h);
}

// ---- Bullet ----

export function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet): void {
  if (!b.active) return;
  const { x: sx, y: sy } = b.position;
  const isPlayer = b.ownerId === "player";
  ctx.save();

  if (b.bulletType === "laser") {
    ctx.shadowColor = isPlayer ? "#00ffff" : "#ff4400";
    ctx.shadowBlur = 8;
    ctx.fillStyle = isPlayer ? "#00ffff" : "#ff6644";
    ctx.beginPath(); ctx.ellipse(sx, sy, 8, 2, b.rotation, 0, Math.PI * 2); ctx.fill();
  } else if (b.bulletType === "missile") {
    ctx.shadowColor = "#ffaa00"; ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffcc00";
    ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff660066";
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.shadowColor = isPlayer ? "#00ccff" : "#ff4400";
    ctx.shadowBlur = 6;
    ctx.fillStyle = isPlayer ? "#00eeff" : "#ff5533";
    ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---- Power-Up ----

export function drawPowerUp(ctx: CanvasRenderingContext2D, p: PowerUp, time: number): void {
  if (!p.active) return;
  const { x: sx, y: sy } = p.position;
  const bobY = sy + Math.sin(time * 3) * 4;
  const spin = time * 2;
  const size = 14 + Math.sin(time * 5) * 2;
  const color = puColor(p.powerUpType);

  ctx.save();
  ctx.translate(sx, bobY);
  ctx.rotate(spin);
  ctx.shadowColor = color; ctx.shadowBlur = 15;

  ctx.fillStyle = `${color}44`;
  ctx.beginPath(); ctx.arc(0, 0, size + 4, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, 0); ctx.lineTo(0, size); ctx.lineTo(-size * 0.7, 0);
  ctx.closePath(); ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.rotate(-spin);
  ctx.fillText(puIcon(p.powerUpType), 0, 0);
  ctx.restore();
}

function puColor(t: string): string {
  switch (t) {
    case "health": return "#44ff44";
    case "shield": return "#4488ff";
    case "rapidFire": return "#ffaa00";
    case "spread": return "#ff44ff";
    case "missile": return "#ff6600";
    case "speedBoost": return "#00ffaa";
    default: return "#fff";
  }
}
function puIcon(t: string): string {
  switch (t) {
    case "health": return "+";
    case "shield": return "O";
    case "rapidFire": return "R";
    case "spread": return "S";
    case "missile": return "M";
    case "speedBoost": return ">";
    default: return "?";
  }
}

// ---- Death Explosion ----

export function drawDeathExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number): void {
  const r = 60 * progress;
  const a = 1 - progress;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = "#ff6622"; ctx.lineWidth = 4 * (1 - progress);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#ffcc44"; ctx.globalAlpha = a * 0.5;
  ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- Damage Flash ----

export function drawDamageFlash(ctx: CanvasRenderingContext2D, x: number, y: number, timer: number): void {
  if (timer <= 0) return;
  ctx.save();
  ctx.globalAlpha = timer * 0.8;
  ctx.fillStyle = "#ff3333";
  ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
