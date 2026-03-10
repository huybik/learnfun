import type { GameCtx } from './types'
import { el } from './utils'
import { sfxCorrect, sfxCoin } from './audio'

export function renderHUD(root: HTMLElement, score: number, center: string, streak: number) {
  const hud = el('div', 'hud')
  hud.innerHTML = `
    <div class="hud-left"><span class="hud-star">⭐</span> <span class="hud-score-val">${score}</span></div>
    <div class="hud-center">${center}</div>
    <div class="hud-right">${streak >= 2 ? `<span class="hud-streak">🔥 ${streak}</span>` : ''}</div>
  `
  root.appendChild(hud)
}

export function updateHUD(root: HTMLElement, score: number, streak: number) {
  const scoreEl = root.querySelector('.hud-score-val')
  if (scoreEl) {
    scoreEl.textContent = String(score)
    scoreEl.classList.remove('pulse')
    void (scoreEl as HTMLElement).offsetWidth
    scoreEl.classList.add('pulse')
  }
  const rightEl = root.querySelector('.hud-right')
  if (rightEl) {
    rightEl.innerHTML = streak >= 2 ? `<span class="hud-streak">🔥 ${streak}</span>` : ''
  }
}

export function renderDots(root: HTMLElement, current: number, total: number) {
  const dots = el('div', 'progress-dots')
  for (let i = 0; i < total; i++) {
    dots.appendChild(el('div', i < current ? 'dot done' : i === current ? 'dot active' : 'dot'))
  }
  root.appendChild(dots)
}

export function awardPoints(ctx: GameCtx, amount: number, cardEl?: HTMLElement) {
  ctx.s.score += amount
  sfxCorrect()
  setTimeout(() => sfxCoin(), 200)
  if (cardEl) {
    burstParticles(cardEl)
    floatScore(cardEl, `+${amount}`)
  }
  updateHUD(ctx.root, ctx.s.score, ctx.s.streak)
}

export function burstParticles(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
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
    p.style.left = `${cx}px`
    p.style.top = `${cy}px`
    p.style.background = colors[i % colors.length]
    p.style.width = p.style.height = `${6 + Math.random() * 6}px`
    document.body.appendChild(p)
    p.addEventListener('animationend', () => p.remove())
  }
}

export function floatScore(target: HTMLElement, text: string) {
  const rect = target.getBoundingClientRect()
  const f = document.createElement('div')
  f.className = 'float-score'
  f.textContent = text
  f.style.left = `${rect.left + rect.width / 2}px`
  f.style.top = `${rect.top}px`
  document.body.appendChild(f)
  f.addEventListener('animationend', () => f.remove())
}

export function shakeEl(target: HTMLElement) {
  target.classList.add('shake')
  target.addEventListener('animationend', () => target.classList.remove('shake'), { once: true })
}
