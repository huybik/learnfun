import type { GameCtx } from './types'
import { getFruitSvg } from './fruits'
import { sfxCorrect, sfxCoin, sfxWrong, sfxWhoosh } from './audio'
import { el } from './utils'

export function renderHUD(root: HTMLElement, coins: number, center: string, right = '') {
  const hud = el('div', 'hud')
  hud.innerHTML = `
    <div class="hud-left"><span class="hud-star">🪙</span> <span class="hud-score-val">${coins}</span></div>
    <div class="hud-center">${center}</div>
    <div class="hud-right">${right}</div>
  `
  root.appendChild(hud)
}

export function renderDots(root: HTMLElement, current: number, total: number) {
  const dots = el('div', 'progress-dots')
  for (let i = 0; i < total; i++) {
    dots.appendChild(el('div', i < current ? 'dot done' : i === current ? 'dot active' : 'dot'))
  }
  root.appendChild(dots)
}

export function makeFruitCard(fruit: string, i: number, extraClass = ''): HTMLElement {
  const card = el('div', 'fruit-card' + (extraClass ? ' ' + extraClass : ''))
  card.style.animationDelay = `${i * 0.07}s`
  const inner = el('div', 'fruit-inner')
  const svgWrap = el('div', 'fruit-svg')
  svgWrap.innerHTML = getFruitSvg(fruit)
  inner.appendChild(svgWrap)
  const label = el('span', 'fruit-label')
  label.textContent = fruit
  inner.appendChild(label)
  card.appendChild(inner)
  return card
}

export function streakHtml(streak: number): string {
  return streak >= 2 ? `<span class="hud-streak">🔥 ${streak}</span>` : ''
}

export function awardPoints(ctx: GameCtx, amount: number, card?: HTMLElement) {
  ctx.s.coins += amount
  ctx.s.score += amount
  sfxCorrect()
  setTimeout(() => sfxCoin(), 200)
  if (card) { burstParticles(card); floatScore(card, `+${amount}`) }
  updateHUD(ctx.root, ctx.s.coins, ctx.s.streak)
}

export function updateHUD(root: HTMLElement, coins: number, streak: number) {
  const scoreEl = root.querySelector('.hud-score-val')
  if (scoreEl) {
    scoreEl.textContent = String(coins)
    scoreEl.classList.remove('pulse')
    void (scoreEl as HTMLElement).offsetWidth
    scoreEl.classList.add('pulse')
  }
  const streakEl = root.querySelector('.hud-right')
  if (streakEl) {
    streakEl.innerHTML = streak >= 2 ? `<span class="hud-streak">🔥 ${streak}</span>` : ''
  }
}

export function burstParticles(card: HTMLElement) {
  const rect = card.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF922B', '#CC5DE8']
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div')
    p.className = 'particle'
    const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.3
    const dist = 50 + Math.random() * 60
    p.style.setProperty('--px', `${Math.cos(angle) * dist}px`)
    p.style.setProperty('--py', `${Math.sin(angle) * dist}px`)
    p.style.left = `${cx}px`; p.style.top = `${cy}px`
    p.style.background = colors[i % colors.length]
    p.style.width = p.style.height = `${6 + Math.random() * 6}px`
    document.body.appendChild(p)
    p.addEventListener('animationend', () => p.remove())
  }
}

export function floatScore(card: HTMLElement, text: string) {
  const rect = card.getBoundingClientRect()
  const f = document.createElement('div')
  f.className = 'float-score'
  f.textContent = text
  f.style.left = `${rect.left + rect.width / 2}px`
  f.style.top = `${rect.top}px`
  document.body.appendChild(f)
  f.addEventListener('animationend', () => f.remove())
}

/** Shared pick handler for single-answer quiz phases (oddoneout, pattern). */
export function handleQuizPick(
  ctx: GameCtx, picked: string, correct: string, pool: string[],
  renderFn: (ctx: GameCtx) => void,
  correctEvent: [string, Record<string, unknown>],
  wrongEvent: [string, Record<string, unknown>],
) {
  const { root, s, bridge } = ctx
  if (s.isFollower) {
    bridge.emitEvent('_relay', { name: 'submit', params: { value: picked } })
    return
  }
  const isCorrect = picked.toLowerCase() === correct.toLowerCase()
  if (isCorrect) {
    s.streak++
    const cards = root.querySelectorAll<HTMLElement>('.fruit-card')
    const idx = pool.findIndex(f => f.toLowerCase() === picked.toLowerCase())
    awardPoints(ctx, 10, idx >= 0 ? cards[idx] : undefined)
    bridge.emitEvent(correctEvent[0], correctEvent[1])
  } else {
    s.streak = 0; sfxWrong()
    bridge.emitEvent(wrongEvent[0], wrongEvent[1])
  }
  renderFn(ctx)
  ctx.sync()
  if (!s.isFollower) {
    s.advanceTimer = window.setTimeout(() => ctx.advance(), 2000)
  }
}

/** Shared reveal handler for single-answer quiz phases. */
export function doQuizReveal(ctx: GameCtx, renderFn: (ctx: GameCtx) => void) {
  sfxWhoosh()
  renderFn(ctx); ctx.sync()
  if (!ctx.s.isFollower) {
    ctx.s.advanceTimer = window.setTimeout(() => ctx.advance(), 2200)
  }
}
