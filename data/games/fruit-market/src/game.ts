import type { GameAPI } from '@learnfun/game-sdk'
import { GameBridge } from '@learnfun/game-sdk'
import { getFruitSvg } from './fruits'
import { sfxPop, sfxCorrect, sfxWrong, sfxCoin, sfxComplete, sfxWhoosh } from './audio'

interface IntroItem {
  fruit: string
  title?: string
  fact?: string
}

interface Challenge {
  id: number | string
  fruit: string
  hint?: string
  pool: string[]
}

type Phase = 'learn' | 'play'

export class FruitMarketGame implements GameAPI {
  private bridge: GameBridge
  private root: HTMLElement
  private phase: Phase = 'play'
  private intro: IntroItem[] = []
  private introIdx = 0
  private challenges: Challenge[] = []
  private idx = 0
  private score = 0
  private streak = 0
  private answered = false
  private wrongAttempts = 0
  private advanceTimer = 0

  constructor(root: HTMLElement, bridge: GameBridge) {
    this.root = root
    this.bridge = bridge
  }

  init(data: unknown) {
    const d = data as Record<string, unknown>
    this.challenges = (d.challenges as Challenge[]) || []
    this.intro = (d.intro as IntroItem[]) || []
    this.introIdx = 0
    this.idx = 0
    this.score = 0
    this.streak = 0
    this.answered = false
    this.wrongAttempts = 0
    clearTimeout(this.advanceTimer)

    // If intro items exist, start in learn phase
    this.phase = this.intro.length > 0 ? 'learn' : 'play'
    this.render()
    this.sync()
    this.bridge.emitEvent('gameStarted', { total: this.challenges.length, phase: this.phase })
  }

  handleAction(name: string, params: Record<string, unknown>) {
    const actions: Record<string, () => void> = {
      submit: () => {
        if (this.phase !== 'play') return
        const val = String(params.value ?? '')
        const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
        const c = this.challenges[this.idx]
        if (!c) return
        const pool = c.pool || []
        const i = pool.findIndex(f => f.toLowerCase() === val.toLowerCase())
        if (i >= 0 && cards[i]) this.handlePick(val, cards[i])
      },
      next: () => this.advance(),
      reveal: () => this.doReveal(),
      jump: () => {
        if (this.phase === 'learn') {
          this.introIdx = clamp(Number(params.to), 0, this.intro.length - 1)
          this.render()
        } else {
          this.idx = clamp(Number(params.to), 0, this.challenges.length - 1)
          this.answered = false
          this.wrongAttempts = 0
          clearTimeout(this.advanceTimer)
          this.render()
        }
      },
      end: () => this.finish(),
      set: () => {
        const field = String(params.field)
        if (field === 'score') { this.score = Number(params.value); this.updateHUD() }
        if (field === 'phase') {
          const val = String(params.value)
          if (val === 'play' || val === 'learn') {
            this.phase = val
            if (val === 'play') { this.idx = 0; this.answered = false; this.wrongAttempts = 0 }
            if (val === 'learn') this.introIdx = 0
            this.render()
          }
        }
      },
    }
    actions[name]?.()
    this.sync()
  }

  getState() {
    if (this.phase === 'learn') {
      const item = this.intro[this.introIdx]
      return {
        phase: 'learn' as const,
        introIndex: this.introIdx,
        introTotal: this.intro.length,
        currentFruit: item?.fruit ?? '',
      }
    }
    const c = this.challenges[this.idx]
    return {
      phase: 'play' as const,
      challengeIndex: this.idx,
      score: this.score,
      total: this.challenges.length,
      streak: this.streak,
      answered: this.answered,
      isComplete: this.idx >= this.challenges.length,
      currentFruit: c?.fruit ?? '',
    }
  }

  destroy() {
    clearTimeout(this.advanceTimer)
    this.root.innerHTML = ''
  }

  // ===================== Rendering =====================

  private render() {
    if (this.phase === 'learn') {
      this.renderIntro()
    } else {
      this.renderChallenge()
    }
  }

  private renderIntro() {
    const item = this.intro[this.introIdx]
    if (!item) return
    this.root.innerHTML = ''

    // Phase label
    const phaseLabel = el('div', 'phase-label')
    phaseLabel.textContent = `Let's learn! ${this.introIdx + 1} / ${this.intro.length}`
    this.root.appendChild(phaseLabel)

    // Intro card — big centered fruit
    const card = el('div', 'intro-card')
    card.innerHTML = `
      <div class="intro-svg">${getFruitSvg(item.fruit)}</div>
      <h2 class="intro-title">${item.title || item.fruit}</h2>
      ${item.fact ? `<p class="intro-fact">${item.fact}</p>` : ''}
    `
    this.root.appendChild(card)

    // Progress dots
    const dots = el('div', 'progress-dots')
    for (let i = 0; i < this.intro.length; i++) {
      const dot = el('div', i < this.introIdx ? 'dot done' : i === this.introIdx ? 'dot active' : 'dot')
      dots.appendChild(dot)
    }
    this.root.appendChild(dots)
  }

  private renderChallenge() {
    const c = this.challenges[this.idx]
    if (!c) return
    this.root.innerHTML = ''

    // HUD
    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">${this.idx + 1} / ${this.challenges.length}</div>
      <div class="hud-right">${this.streak >= 2 ? '<span class="hud-streak">🔥 ' + this.streak + '</span>' : ''}</div>
    `
    this.root.appendChild(hud)

    // Challenge hint
    const hint = el('div', 'challenge-hint')
    hint.textContent = c.hint || `Find the ${c.fruit}!`
    this.root.appendChild(hint)

    // Fruit grid
    const grid = el('div', 'fruit-grid')
    const pool = c.pool || [c.fruit]

    // Determine grid columns based on pool size
    const cols = pool.length <= 4 ? 2 : pool.length <= 6 ? 3 : 4
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

    pool.forEach((fruitName, i) => {
      const card = el('div', 'fruit-card')
      card.style.animationDelay = `${i * 0.07}s`

      const inner = el('div', 'fruit-inner')
      const svgWrap = el('div', 'fruit-svg')
      svgWrap.innerHTML = getFruitSvg(fruitName)
      inner.appendChild(svgWrap)

      const label = el('span', 'fruit-label')
      label.textContent = fruitName
      inner.appendChild(label)
      card.appendChild(inner)

      if (!this.answered) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handlePick(fruitName, card))
      }

      grid.appendChild(card)
    })

    this.root.appendChild(grid)

    // Progress dots
    const dots = el('div', 'progress-dots')
    for (let i = 0; i < this.challenges.length; i++) {
      const dot = el('div', i < this.idx ? 'dot done' : i === this.idx ? 'dot active' : 'dot')
      dots.appendChild(dot)
    }
    this.root.appendChild(dots)
  }

  // ===================== Interaction =====================

  private handlePick(fruitName: string, card: HTMLElement) {
    if (this.answered) return
    const c = this.challenges[this.idx]
    if (!c) return

    const isCorrect = fruitName.toLowerCase() === c.fruit.toLowerCase()

    if (isCorrect) {
      this.answered = true
      this.score += 10
      this.streak++

      card.classList.add('is-correct')
      sfxCorrect()
      setTimeout(() => sfxCoin(), 350)
      this.burstParticles(card)
      this.floatScore(card)
      this.updateHUD()

      // Dim other cards
      this.root.querySelectorAll<HTMLElement>('.fruit-card').forEach(c => {
        if (c !== card) c.classList.add('is-dimmed')
      })

      this.bridge.emitEvent('correctAnswer', {
        challengeIndex: this.idx, expected: c.fruit, given: fruitName, score: this.score,
      })
      this.sync()
      this.advanceTimer = window.setTimeout(() => this.advance(), 1800)

    } else {
      this.wrongAttempts++
      card.classList.add('is-wrong')
      sfxWrong()
      setTimeout(() => card.classList.remove('is-wrong'), 500)

      this.streak = 0
      this.updateHUD()

      this.bridge.emitEvent('incorrectAnswer', {
        challengeIndex: this.idx, expected: c.fruit, given: fruitName, score: this.score,
      })

      if (this.wrongAttempts >= 3) {
        this.doReveal()
      }
    }
  }

  private doReveal() {
    if (this.answered) return
    this.answered = true
    const c = this.challenges[this.idx]
    if (!c) return

    sfxWhoosh()

    // Highlight correct fruit
    const pool = c.pool || []
    const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
    pool.forEach((name, i) => {
      if (name.toLowerCase() === c.fruit.toLowerCase()) {
        cards[i]?.classList.add('is-revealed')
      } else {
        cards[i]?.classList.add('is-dimmed')
      }
    })

    this.sync()
    this.advanceTimer = window.setTimeout(() => this.advance(), 2200)
  }

  private advance() {
    clearTimeout(this.advanceTimer)

    if (this.phase === 'learn') {
      if (this.introIdx < this.intro.length - 1) {
        this.introIdx++
        sfxPop()
        this.render()
        this.sync()
        this.bridge.emitEvent('introAdvance', { index: this.introIdx, fruit: this.intro[this.introIdx]?.fruit })
      } else {
        // Done with intros → transition to play
        this.phase = 'play'
        this.idx = 0
        this.answered = false
        this.wrongAttempts = 0
        sfxWhoosh()
        this.render()
        this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'play' })
      }
      return
    }

    if (this.idx < this.challenges.length - 1) {
      this.idx++
      this.answered = false
      this.wrongAttempts = 0
      this.render()
      this.sync()
    } else {
      this.finish()
    }
  }

  private finish() {
    clearTimeout(this.advanceTimer)
    sfxComplete()
    this.bridge.emitEvent('gameCompleted', { score: this.score, total: this.challenges.length })
    this.bridge.endGame({ outcome: 'completed', finalScore: this.score })

    this.root.innerHTML = ''
    const screen = el('div', 'end-screen')
    screen.innerHTML = `
      <div class="end-trophy">🏆</div>
      <h2 class="end-title">Great Job!</h2>
      <div class="end-score">
        <span class="end-star">★</span> ${this.score} <span class="end-max">/ ${this.challenges.length * 10}</span>
      </div>
      <div class="end-streak">Best streak: 🔥 ${this.streak}</div>
    `
    this.root.appendChild(screen)
  }

  // ===================== Effects =====================

  private updateHUD() {
    const scoreEl = this.root.querySelector('.hud-score-val')
    if (scoreEl) {
      scoreEl.textContent = String(this.score)
      scoreEl.classList.remove('pulse')
      void (scoreEl as HTMLElement).offsetWidth // reflow
      scoreEl.classList.add('pulse')
    }
    const streakEl = this.root.querySelector('.hud-right')
    if (streakEl) {
      streakEl.innerHTML = this.streak >= 2 ? `<span class="hud-streak">🔥 ${this.streak}</span>` : ''
    }
  }

  private burstParticles(card: HTMLElement) {
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
      p.style.left = `${cx}px`
      p.style.top = `${cy}px`
      p.style.background = colors[i % colors.length]
      p.style.width = p.style.height = `${6 + Math.random() * 6}px`
      document.body.appendChild(p)
      p.addEventListener('animationend', () => p.remove())
    }
  }

  private floatScore(card: HTMLElement) {
    const rect = card.getBoundingClientRect()
    const f = document.createElement('div')
    f.className = 'float-score'
    f.textContent = '+10'
    f.style.left = `${rect.left + rect.width / 2}px`
    f.style.top = `${rect.top}px`
    document.body.appendChild(f)
    f.addEventListener('animationend', () => f.remove())
  }

  private sync() {
    this.bridge.updateState(this.getState())
  }
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
