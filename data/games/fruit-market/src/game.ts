import type { GameAPI } from '@learnfun/game-sdk'
import { GameBridge } from '@learnfun/game-sdk'
import { getFruitSvg } from './fruits'
import basketSvg from './assets/basket.svg?raw'
import { sfxPop, sfxCorrect, sfxWrong, sfxCoin, sfxComplete, sfxWhoosh } from './audio'

// ===================== Types =====================

interface IntroItem { fruit: string; title?: string; fact?: string }
interface Challenge { id: number | string; fruit: string; hint?: string; pool: string[]; mode?: 'find' | 'shadow' | 'describe' }
interface SortCategory { name: string; emoji?: string; fruits: string[] }
interface SortRound { fruits: string[]; categories: SortCategory[] }
interface ShopItem { fruit: string; price: number }
interface ShopData { budget: number; items: ShopItem[]; goal?: string }
interface MemoryRound { fruits: string[] }
interface OddOneOutRound { fruits: string[]; odd: string; trait: string; explanation?: string }
interface PatternRound { sequence: string[]; answer: string; options: string[] }
interface RecipeData { name: string; emoji?: string; required: string[]; available: ShopItem[]; budget: number }

type Phase = 'learn' | 'play' | 'memory' | 'oddoneout' | 'pattern' | 'sort' | 'shop' | 'recipe'
const WAVE_SIZE = 4
const BIN_COLORS: Record<string, [string, string]> = {
  '🔴': ['#EF9A9A', '#C62828'],
  '🟡': ['#FFF176', '#F9A825'],
  '🟣': ['#CE93D8', '#7B1FA2'],
  '🟢': ['#A5D6A7', '#2E7D32'],
  '🔵': ['#90CAF9', '#1565C0'],
  '🟠': ['#FFCC80', '#E65100'],
  '🟤': ['#BCAAA4', '#4E342E'],
}

function coloredBasket(idx: number, light: string, dark: string): string {
  const g = `cb${idx}`
  return `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${g}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${light}"/><stop offset="100%" stop-color="${dark}"/>
    </linearGradient></defs>
    <path d="M34,52 C34,20 94,20 94,52" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round"/>
    <path d="M34,52 C34,24 94,24 94,52" fill="none" stroke="${light}" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
    <path d="M18,56 L28,108 C30,114 36,118 42,118 L86,118 C92,118 98,114 100,108 L110,56 Z" fill="url(#${g})"/>
    <line x1="22" y1="68" x2="106" y2="68" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
    <line x1="24" y1="80" x2="104" y2="80" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
    <line x1="26" y1="92" x2="102" y2="92" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
    <line x1="28" y1="104" x2="100" y2="104" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
    <line x1="40" y1="56" x2="36" y2="118" stroke="${dark}" stroke-width="1.5" opacity="0.25"/>
    <line x1="56" y1="56" x2="52" y2="118" stroke="${dark}" stroke-width="1.5" opacity="0.25"/>
    <line x1="72" y1="56" x2="72" y2="118" stroke="${dark}" stroke-width="1.5" opacity="0.25"/>
    <line x1="88" y1="56" x2="88" y2="118" stroke="${dark}" stroke-width="1.5" opacity="0.25"/>
    <rect x="16" y="52" width="96" height="10" rx="5" fill="${dark}"/>
    <rect x="20" y="53" width="88" height="3" rx="1.5" fill="white" opacity="0.3"/>
    <path d="M22,62 L110,62 L108,66 L20,66 Z" fill="${dark}" opacity="0.15"/>
  </svg>`
}

export class FruitMarketGame implements GameAPI {
  private bridge: GameBridge
  private root: HTMLElement
  private phase: Phase = 'play'
  private wave = 0

  // Learn
  private intro: IntroItem[] = []
  private introIdx = 0

  // Play
  private challenges: Challenge[] = []
  private idx = 0
  private score = 0
  private streak = 0
  private answered = false
  private wrongAttempts = 0
  private advanceTimer = 0

  // Timer
  private timerEnabled = false
  private timerDuration = 10000
  private timerStart = 0

  // Sort
  private sortRounds: SortRound[] = []
  private sortIdx = 0
  private sortRemaining: string[] = []
  private sortSelected: string | null = null

  // Shop
  private shopData: ShopData | null = null
  private shopBudget = 0
  private shopBasket: string[] = []

  // Drag
  private dragEl: HTMLElement | null = null
  private dragFruit: string | null = null
  private dragOffsetX = 0
  private dragOffsetY = 0
  private rerender = false

  // Memory
  private memoryRounds: MemoryRound[] = []
  private memoryIdx = 0
  private memoryCards: { fruit: string; id: number }[] = []
  private memoryFlipped: number[] = []
  private memoryMatched: Set<number> = new Set()
  private memoryLocked = false

  // Odd one out
  private oddRounds: OddOneOutRound[] = []
  private oddIdx = 0
  private oddAnswered = false

  // Pattern
  private patternRounds: PatternRound[] = []
  private patternIdx = 0
  private patternAnswered = false

  // Recipe
  private recipes: RecipeData[] = []
  private recipeIdx = 0
  private recipeBudget = 0
  private recipeBasket: string[] = []

  constructor(root: HTMLElement, bridge: GameBridge) {
    this.root = root
    this.bridge = bridge
  }

  init(data: unknown) {
    const d = data as Record<string, unknown>
    this.challenges = (d.challenges as Challenge[]) || []
    this.intro = (d.intro as IntroItem[]) || []
    this.sortRounds = (d.sort as SortRound[]) || []
    this.shopData = (d.shop as ShopData) || null
    this.memoryRounds = (d.memory as MemoryRound[]) || []
    this.oddRounds = (d.oddoneout as OddOneOutRound[]) || []
    this.patternRounds = (d.pattern as PatternRound[]) || []
    this.recipes = (d.recipes as RecipeData[]) || []
    this.timerEnabled = !!d.timed
    this.timerDuration = Number(d.timerDuration) || 10000

    this.wave = 0; this.introIdx = 0; this.idx = 0
    this.score = 0; this.streak = 0; this.answered = false; this.wrongAttempts = 0
    this.sortIdx = 0; this.sortRemaining = []; this.sortSelected = null
    this.shopBudget = this.shopData?.budget ?? 0; this.shopBasket = []
    this.memoryIdx = 0; this.memoryCards = []; this.memoryFlipped = []
    this.memoryMatched = new Set(); this.memoryLocked = false
    this.oddIdx = 0; this.oddAnswered = false
    this.patternIdx = 0; this.patternAnswered = false
    this.recipeIdx = 0; this.recipeBudget = this.recipes[0]?.budget ?? 0; this.recipeBasket = []
    clearTimeout(this.advanceTimer)

    this.phase = this.intro.length > 0 ? 'learn' : 'play'
    this.render()
    this.sync()
    this.bridge.emitEvent('gameStarted', { total: this.challenges.length, phase: this.phase })
  }

  handleAction(name: string, params: Record<string, unknown>) {
    const actions: Record<string, () => void> = {
      submit: () => {
        const val = String(params.value ?? '')
        if (this.phase === 'play') {
          const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
          const c = this.challenges[this.idx]
          if (!c) return
          const i = (c.pool || []).findIndex(f => f.toLowerCase() === val.toLowerCase())
          if (i >= 0 && cards[i]) this.handlePick(val, cards[i])
        }
        if (this.phase === 'sort') {
          const round = this.sortRounds[this.sortIdx]
          if (!round) return
          const cat = round.categories.find(c => c.fruits.some(f => f.toLowerCase() === val.toLowerCase()))
          const actual = this.sortRemaining.find(f => f.toLowerCase() === val.toLowerCase())
          if (cat && actual) { this.sortSelected = actual; this.handleSort(actual, cat) }
        }
        if (this.phase === 'shop') {
          const item = this.shopData?.items.find(i => i.fruit.toLowerCase() === val.toLowerCase())
          if (item) this.handleBuy(item)
        }
        if (this.phase === 'memory') {
          const idx = this.memoryCards.findIndex(c => c.fruit.toLowerCase() === val.toLowerCase() && !this.memoryMatched.has(c.id) && !this.memoryFlipped.includes(c.id))
          if (idx >= 0) this.handleMemoryFlip(this.memoryCards[idx].id)
        }
        if (this.phase === 'oddoneout') this.handleOddPick(val)
        if (this.phase === 'pattern') this.handlePatternPick(val)
        if (this.phase === 'recipe') {
          const item = this.recipes[this.recipeIdx]?.available.find(i => i.fruit.toLowerCase() === val.toLowerCase())
          if (item) this.handleRecipeBuy(item)
        }
      },
      next: () => this.advance(),
      reveal: () => {
        if (this.phase === 'play') this.doReveal()
        if (this.phase === 'sort') this.doSortReveal()
        if (this.phase === 'oddoneout') this.doOddReveal()
        if (this.phase === 'pattern') this.doPatternReveal()
      },
      jump: () => {
        const to = Number(params.to)
        if (this.phase === 'learn') {
          this.introIdx = clamp(to, 0, this.intro.length - 1)
          this.wave = Math.floor(this.introIdx / WAVE_SIZE)
        } else if (this.phase === 'play') {
          this.idx = clamp(to, 0, this.challenges.length - 1)
          this.wave = Math.floor(this.idx / WAVE_SIZE)
          this.answered = false; this.wrongAttempts = 0; clearTimeout(this.advanceTimer)
        } else if (this.phase === 'sort') {
          this.sortIdx = clamp(to, 0, this.sortRounds.length - 1); this.initSortRound()
        } else if (this.phase === 'memory') {
          this.memoryIdx = clamp(to, 0, this.memoryRounds.length - 1); this.initMemoryRound()
        } else if (this.phase === 'oddoneout') {
          this.oddIdx = clamp(to, 0, this.oddRounds.length - 1); this.oddAnswered = false
        } else if (this.phase === 'pattern') {
          this.patternIdx = clamp(to, 0, this.patternRounds.length - 1); this.patternAnswered = false
        }
        this.render()
      },
      end: () => this.finish(),
      set: () => {
        const field = String(params.field)
        if (field === 'score') { this.score = Number(params.value); this.updateHUD() }
        if (field === 'phase') {
          const val = String(params.value) as Phase
          if (['play', 'learn', 'sort', 'shop', 'memory', 'oddoneout', 'pattern', 'recipe'].includes(val)) this.transitionTo(val)
        }
      },
    }
    actions[name]?.()
    this.sync()
  }

  getState() {
    if (this.phase === 'learn') {
      const item = this.intro[this.introIdx]
      return { phase: 'learn' as const, introIndex: this.introIdx, introTotal: this.intro.length, currentFruit: item?.fruit ?? '', wave: this.wave }
    }
    if (this.phase === 'memory') {
      return { phase: 'memory' as const, round: this.memoryIdx, total: this.memoryRounds.length, matched: this.memoryMatched.size / 2, pairs: this.memoryCards.length / 2, score: this.score }
    }
    if (this.phase === 'oddoneout') {
      const r = this.oddRounds[this.oddIdx]
      return { phase: 'oddoneout' as const, round: this.oddIdx, total: this.oddRounds.length, trait: r?.trait ?? '', answered: this.oddAnswered, score: this.score }
    }
    if (this.phase === 'pattern') {
      return { phase: 'pattern' as const, round: this.patternIdx, total: this.patternRounds.length, answered: this.patternAnswered, score: this.score }
    }
    if (this.phase === 'sort') {
      return { phase: 'sort' as const, sortRound: this.sortIdx, sortTotal: this.sortRounds.length, remaining: this.sortRemaining.length, score: this.score }
    }
    if (this.phase === 'shop') {
      return { phase: 'shop' as const, budget: this.shopBudget, basketSize: this.shopBasket.length, basket: [...this.shopBasket], score: this.score }
    }
    if (this.phase === 'recipe') {
      const r = this.recipes[this.recipeIdx]
      const got = this.recipeBasket.filter(f => r?.required.includes(f)).length
      return { phase: 'recipe' as const, recipe: r?.name ?? '', round: this.recipeIdx, total: this.recipes.length, budget: this.recipeBudget, basket: [...this.recipeBasket], remaining: (r?.required.length ?? 0) - got, score: this.score }
    }
    const c = this.challenges[this.idx]
    return {
      phase: 'play' as const, challengeIndex: this.idx, score: this.score, total: this.challenges.length,
      streak: this.streak, answered: this.answered, isComplete: this.idx >= this.challenges.length, currentFruit: c?.fruit ?? '', wave: this.wave,
    }
  }

  destroy() { clearTimeout(this.advanceTimer); this.root.innerHTML = '' }

  // ===================== Phase Flow =====================

  private get totalWaves(): number {
    if (this.intro.length === 0 || this.challenges.length === 0) return 1
    return Math.max(Math.ceil(this.intro.length / WAVE_SIZE), Math.ceil(this.challenges.length / WAVE_SIZE))
  }

  private waveIntroEnd() { return Math.min((this.wave + 1) * WAVE_SIZE, this.intro.length) }
  private waveChallengeEnd() { return Math.min((this.wave + 1) * WAVE_SIZE, this.challenges.length) }
  private waveHasIntros() { return this.wave * WAVE_SIZE < this.intro.length }
  private waveHasChallenges() { return this.wave * WAVE_SIZE < this.challenges.length }

  private transitionTo(phase: Phase) {
    this.phase = phase
    sfxWhoosh()
    clearTimeout(this.advanceTimer)
    if (phase === 'learn') { this.wave = 0; this.introIdx = 0 }
    if (phase === 'play') { this.wave = 0; this.idx = 0; this.answered = false; this.wrongAttempts = 0 }
    if (phase === 'sort') { this.sortIdx = 0; this.initSortRound() }
    if (phase === 'shop') { this.shopBudget = this.shopData?.budget ?? 0; this.shopBasket = [] }
    if (phase === 'memory') { this.memoryIdx = 0; this.initMemoryRound() }
    if (phase === 'oddoneout') { this.oddIdx = 0; this.oddAnswered = false }
    if (phase === 'pattern') { this.patternIdx = 0; this.patternAnswered = false }
    if (phase === 'recipe') { this.recipeIdx = 0; this.recipeBudget = this.recipes[0]?.budget ?? 0; this.recipeBasket = [] }
    this.render()
    this.sync()
    this.bridge.emitEvent('phaseChange', { phase })
  }

  private nextPhaseAfter(current: Phase) {
    const order: [Phase, () => boolean][] = [
      ['memory', () => this.memoryRounds.length > 0],
      ['oddoneout', () => this.oddRounds.length > 0],
      ['pattern', () => this.patternRounds.length > 0],
      ['sort', () => this.sortRounds.length > 0],
      ['recipe', () => this.recipes.length > 0],
      ['shop', () => !!this.shopData],
    ]
    const start = current === 'play' || current === 'learn' ? 0 : order.findIndex(([p]) => p === current) + 1
    for (let i = start; i < order.length; i++) {
      if (order[i][1]()) { this.transitionTo(order[i][0]); return }
    }
    this.finish()
  }

  private advanceWave() {
    this.wave++
    if (this.wave < this.totalWaves) {
      if (this.waveHasIntros()) {
        this.phase = 'learn'; this.introIdx = this.wave * WAVE_SIZE
        sfxWhoosh(); this.render(); this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'learn' })
      } else if (this.waveHasChallenges()) {
        this.phase = 'play'; this.idx = this.wave * WAVE_SIZE
        this.answered = false; this.wrongAttempts = 0
        sfxWhoosh(); this.render(); this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'play' })
      } else {
        this.advanceWave()
      }
    } else {
      this.nextPhaseAfter('play')
    }
  }

  private advance() {
    clearTimeout(this.advanceTimer)

    if (this.phase === 'learn') {
      const wEnd = this.waveIntroEnd()
      if (this.introIdx < wEnd - 1) {
        this.introIdx++; sfxPop(); this.render(); this.sync()
        this.bridge.emitEvent('introAdvance', { index: this.introIdx, fruit: this.intro[this.introIdx]?.fruit })
      } else if (this.waveHasChallenges()) {
        this.phase = 'play'; this.idx = this.wave * WAVE_SIZE
        this.answered = false; this.wrongAttempts = 0
        sfxWhoosh(); this.render(); this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'play' })
      } else { this.advanceWave() }
      return
    }

    if (this.phase === 'play') {
      const wEnd = this.waveChallengeEnd()
      if (this.idx < wEnd - 1) {
        this.idx++; this.answered = false; this.wrongAttempts = 0
        this.render(); this.sync()
      } else { this.advanceWave() }
      return
    }

    if (this.phase === 'memory') {
      if (this.memoryIdx < this.memoryRounds.length - 1) {
        this.memoryIdx++; this.initMemoryRound(); this.render(); this.sync()
      } else { this.nextPhaseAfter('memory') }
      return
    }

    if (this.phase === 'oddoneout') {
      if (this.oddIdx < this.oddRounds.length - 1) {
        this.oddIdx++; this.oddAnswered = false; this.render(); this.sync()
      } else { this.nextPhaseAfter('oddoneout') }
      return
    }

    if (this.phase === 'pattern') {
      if (this.patternIdx < this.patternRounds.length - 1) {
        this.patternIdx++; this.patternAnswered = false; this.render(); this.sync()
      } else { this.nextPhaseAfter('pattern') }
      return
    }

    if (this.phase === 'sort') {
      if (this.sortIdx < this.sortRounds.length - 1) {
        this.sortIdx++; this.initSortRound(); this.render(); this.sync()
      } else { this.nextPhaseAfter('sort') }
      return
    }

    if (this.phase === 'recipe') {
      if (this.recipeIdx < this.recipes.length - 1) {
        this.recipeIdx++; this.recipeBudget = this.recipes[this.recipeIdx]?.budget ?? 0
        this.recipeBasket = []; this.render(); this.sync()
      } else { this.nextPhaseAfter('recipe') }
      return
    }

    if (this.phase === 'shop') { this.nextPhaseAfter('shop') }
  }

  // ===================== Rendering =====================

  private render() {
    switch (this.phase) {
      case 'learn': this.renderIntro(); break
      case 'play': this.renderChallenge(); break
      case 'memory': this.renderMemory(); break
      case 'oddoneout': this.renderOddOneOut(); break
      case 'pattern': this.renderPattern(); break
      case 'sort': this.renderSort(); break
      case 'shop': this.renderShop(); break
      case 'recipe': this.renderRecipe(); break
    }
  }

  private renderIntro() {
    const item = this.intro[this.introIdx]
    if (!item) return
    this.root.innerHTML = ''

    const waveStart = this.wave * WAVE_SIZE
    const waveEnd = this.waveIntroEnd()
    const localIdx = this.introIdx - waveStart
    const waveCount = waveEnd - waveStart

    const phaseLabel = el('div', 'phase-label')
    phaseLabel.textContent = this.totalWaves > 1
      ? `Round ${this.wave + 1} — Let's learn!`
      : `Let's learn! ${localIdx + 1} / ${waveCount}`
    this.root.appendChild(phaseLabel)

    const card = el('div', 'intro-card')
    card.innerHTML = `
      <div class="intro-svg">${getFruitSvg(item.fruit)}</div>
      <h2 class="intro-title">${item.title || item.fruit}</h2>
      ${item.fact ? `<p class="intro-fact">${item.fact}</p>` : ''}
    `
    this.root.appendChild(card)

    const dots = el('div', 'progress-dots')
    for (let i = 0; i < waveCount; i++) {
      dots.appendChild(el('div', i < localIdx ? 'dot done' : i === localIdx ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)

    card.style.cursor = 'pointer'
    card.addEventListener('click', () => this.advance())
  }

  private renderChallenge() {
    const c = this.challenges[this.idx]
    if (!c) return
    this.root.innerHTML = ''

    const waveStart = this.wave * WAVE_SIZE
    const waveEnd = this.waveChallengeEnd()
    const localIdx = this.idx - waveStart
    const waveCount = waveEnd - waveStart

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">${this.totalWaves > 1 ? `Round ${this.wave + 1}: ` : ''}${localIdx + 1} / ${waveCount}</div>
      <div class="hud-right">${this.streak >= 2 ? '<span class="hud-streak">🔥 ' + this.streak + '</span>' : ''}</div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    if (c.mode === 'shadow') hint.textContent = c.hint || 'Can you guess by the shape?'
    else if (c.mode === 'describe') hint.textContent = c.hint || 'Which fruit matches this description?'
    else hint.textContent = c.hint || `Find the ${c.fruit}!`
    this.root.appendChild(hint)

    // Timer bar
    if (this.timerEnabled && !this.answered) {
      const track = el('div', 'timer-bar-track')
      const fill = el('div', 'timer-bar-fill')
      fill.style.setProperty('--timer-ms', `${this.timerDuration}ms`)
      track.appendChild(fill)
      this.root.appendChild(track)
      this.timerStart = Date.now()
      this.advanceTimer = window.setTimeout(() => { if (!this.answered) this.doReveal() }, this.timerDuration)
    }

    const grid = el('div', 'fruit-grid')
    if (c.mode === 'shadow') grid.classList.add('shadow-mode')
    if (c.mode === 'describe') grid.classList.add('describe-mode')
    const pool = c.pool || [c.fruit]
    grid.style.gridTemplateColumns = `repeat(${pool.length <= 4 ? 2 : pool.length <= 6 ? 3 : 4}, 1fr)`

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

    const dots = el('div', 'progress-dots')
    for (let i = 0; i < waveCount; i++) {
      dots.appendChild(el('div', i < localIdx ? 'dot done' : i === localIdx ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)
  }

  private renderMemory() {
    this.root.innerHTML = ''
    const round = this.memoryRounds[this.memoryIdx]
    if (!round) return

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">Memory! ${this.memoryMatched.size / 2} / ${this.memoryCards.length / 2}</div>
      <div class="hud-right"></div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    hint.textContent = 'Find the matching pairs!'
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid memory-grid')
    const total = this.memoryCards.length
    const cols = total <= 8 ? 4 : total <= 12 ? 4 : 5
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

    this.memoryCards.forEach((card, i) => {
      const isFlipped = this.memoryFlipped.includes(card.id) || this.memoryMatched.has(card.id)
      const isMatched = this.memoryMatched.has(card.id)
      const cardEl = el('div', 'fruit-card memory-card' + (isFlipped ? ' is-flipped' : '') + (isMatched ? ' is-matched' : ''))
      cardEl.style.animationDelay = `${i * 0.04}s`
      const inner = el('div', 'fruit-inner memory-inner')

      if (isFlipped) {
        const svgWrap = el('div', 'fruit-svg')
        svgWrap.innerHTML = getFruitSvg(card.fruit)
        inner.appendChild(svgWrap)
        const label = el('span', 'fruit-label')
        label.textContent = card.fruit
        inner.appendChild(label)
      } else {
        const back = el('div', 'memory-back')
        back.textContent = '?'
        inner.appendChild(back)
      }

      cardEl.appendChild(inner)
      if (!isFlipped && !this.memoryLocked) {
        cardEl.addEventListener('pointerenter', () => sfxPop())
        cardEl.addEventListener('click', () => this.handleMemoryFlip(card.id))
      }
      grid.appendChild(cardEl)
    })
    this.root.appendChild(grid)

    const dots = el('div', 'progress-dots')
    const pairs = this.memoryCards.length / 2
    const matched = this.memoryMatched.size / 2
    for (let i = 0; i < pairs; i++) {
      dots.appendChild(el('div', i < matched ? 'dot done' : i === matched ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)
  }

  private renderOddOneOut() {
    const round = this.oddRounds[this.oddIdx]
    if (!round) return
    this.root.innerHTML = ''

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">Odd one out! ${this.oddIdx + 1} / ${this.oddRounds.length}</div>
      <div class="hud-right">${this.streak >= 2 ? '<span class="hud-streak">🔥 ' + this.streak + '</span>' : ''}</div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    hint.textContent = `Which one is NOT a ${round.trait}?`
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid')
    grid.style.gridTemplateColumns = `repeat(${round.fruits.length <= 4 ? 2 : 3}, 1fr)`

    round.fruits.forEach((fruit, i) => {
      const isOdd = fruit.toLowerCase() === round.odd.toLowerCase()
      const card = el('div', 'fruit-card')
      card.style.animationDelay = `${i * 0.07}s`
      if (this.oddAnswered) card.classList.add(isOdd ? 'is-correct' : 'is-dimmed')

      const inner = el('div', 'fruit-inner')
      const svgWrap = el('div', 'fruit-svg')
      svgWrap.innerHTML = getFruitSvg(fruit)
      inner.appendChild(svgWrap)
      const label = el('span', 'fruit-label')
      label.textContent = fruit
      inner.appendChild(label)
      card.appendChild(inner)

      if (!this.oddAnswered) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handleOddPick(fruit))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    if (this.oddAnswered && round.explanation) {
      const expl = el('div', 'odd-explanation')
      expl.textContent = round.explanation
      this.root.appendChild(expl)
    }

    const dots = el('div', 'progress-dots')
    for (let i = 0; i < this.oddRounds.length; i++) {
      dots.appendChild(el('div', i < this.oddIdx ? 'dot done' : i === this.oddIdx ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)
  }

  private renderPattern() {
    const round = this.patternRounds[this.patternIdx]
    if (!round) return
    this.root.innerHTML = ''

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">Pattern! ${this.patternIdx + 1} / ${this.patternRounds.length}</div>
      <div class="hud-right">${this.streak >= 2 ? '<span class="hud-streak">🔥 ' + this.streak + '</span>' : ''}</div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    hint.textContent = 'What comes next?'
    this.root.appendChild(hint)

    const seqWrap = el('div', 'pattern-sequence')
    round.sequence.forEach(fruit => {
      const item = el('div', 'pattern-item')
      item.innerHTML = getFruitSvg(fruit)
      seqWrap.appendChild(item)
    })
    if (this.patternAnswered) {
      const ans = el('div', 'pattern-item pattern-answer')
      ans.innerHTML = getFruitSvg(round.answer)
      seqWrap.appendChild(ans)
    } else {
      const blank = el('div', 'pattern-item pattern-blank')
      blank.textContent = '?'
      seqWrap.appendChild(blank)
    }
    this.root.appendChild(seqWrap)

    const grid = el('div', 'fruit-grid')
    grid.style.gridTemplateColumns = `repeat(${round.options.length}, 1fr)`

    round.options.forEach((fruit, i) => {
      const isAnswer = fruit.toLowerCase() === round.answer.toLowerCase()
      const card = el('div', 'fruit-card')
      card.style.animationDelay = `${i * 0.07}s`
      if (this.patternAnswered) card.classList.add(isAnswer ? 'is-correct' : 'is-dimmed')

      const inner = el('div', 'fruit-inner')
      const svgWrap = el('div', 'fruit-svg')
      svgWrap.innerHTML = getFruitSvg(fruit)
      inner.appendChild(svgWrap)
      const label = el('span', 'fruit-label')
      label.textContent = fruit
      inner.appendChild(label)
      card.appendChild(inner)

      if (!this.patternAnswered) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handlePatternPick(fruit))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    const dots = el('div', 'progress-dots')
    for (let i = 0; i < this.patternRounds.length; i++) {
      dots.appendChild(el('div', i < this.patternIdx ? 'dot done' : i === this.patternIdx ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)
  }

  private renderSort() {
    const round = this.sortRounds[this.sortIdx]
    if (!round) return
    this.root.innerHTML = ''

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">Sort! ${this.sortRemaining.length} left</div>
      <div class="hud-right">${this.sortRounds.length > 1 ? `${this.sortIdx + 1}/${this.sortRounds.length}` : ''}</div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    hint.textContent = this.sortSelected
      ? `Where does the ${this.sortSelected} go?`
      : 'Tap a fruit, then pick its bin — or drag!'
    if (this.rerender) hint.style.animation = 'none'
    this.root.appendChild(hint)

    // Category bins (colored baskets)
    const binsWrap = el('div', 'sort-bins')
    round.categories.forEach((cat, catIdx) => {
      const sorted = cat.fruits.filter(f => !this.sortRemaining.includes(f))
      const binClr = BIN_COLORS[cat.emoji || '']
      const bin = el('div', 'sort-bin' + (this.sortSelected ? ' sort-bin-active' : ''))
      const basketEl = el('div', 'sort-bin-basket')
      basketEl.innerHTML = binClr ? coloredBasket(catIdx, binClr[0], binClr[1]) : basketSvg
      bin.appendChild(basketEl)
      if (sorted.length > 0) {
        const fruits = el('div', 'sort-bin-fruits')
        sorted.forEach(f => { const s = el('span', 'sort-bin-fruit'); s.innerHTML = getFruitSvg(f); fruits.appendChild(s) })
        bin.appendChild(fruits)
      }
      const label = el('div', 'sort-bin-label')
      label.textContent = cat.name
      bin.appendChild(label)
      const count = el('div', 'sort-bin-count')
      count.textContent = `${sorted.length} / ${cat.fruits.length}`
      bin.appendChild(count)
      bin.addEventListener('click', () => {
        if (this.sortSelected) this.handleSort(this.sortSelected, cat)
      })
      binsWrap.appendChild(bin)
    })
    this.root.appendChild(binsWrap)

    // Fruit grid
    if (this.sortRemaining.length > 0) {
      const grid = el('div', 'fruit-grid')
      const cols = this.sortRemaining.length <= 4 ? 2 : this.sortRemaining.length <= 6 ? 3 : 4
      grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

      this.sortRemaining.forEach((fruitName, i) => {
        const card = el('div', 'fruit-card' + (fruitName === this.sortSelected ? ' is-selected' : ''))
        if (this.rerender) card.style.animation = 'none'
        else card.style.animationDelay = `${i * 0.07}s`
        const inner = el('div', 'fruit-inner')
        const svgWrap = el('div', 'fruit-svg')
        svgWrap.innerHTML = getFruitSvg(fruitName)
        inner.appendChild(svgWrap)
        const label = el('span', 'fruit-label')
        label.textContent = fruitName
        inner.appendChild(label)
        card.appendChild(inner)
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => {
          this.root.querySelectorAll('.fruit-card.is-selected').forEach(c => c.classList.remove('is-selected'))
          card.classList.add('is-selected')
          this.sortSelected = fruitName
          const h = this.root.querySelector('.challenge-hint')
          if (h) h.textContent = `Where does the ${fruitName} go?`
          this.root.querySelectorAll('.sort-bin').forEach(b => b.classList.add('sort-bin-active'))
        })

        // Drag to sort
        card.style.touchAction = 'none'
        card.addEventListener('pointerdown', (e) => {
          this.startDrag(e, fruitName, card, '.sort-bin', (target) => {
            const bins = [...this.root.querySelectorAll('.sort-bin')]
            const catIdx = bins.indexOf(target)
            if (catIdx >= 0) {
              this.sortSelected = fruitName
              this.handleSort(fruitName, round.categories[catIdx])
            }
          })
        })
        grid.appendChild(card)
      })
      this.root.appendChild(grid)
    }

    const dots = el('div', 'progress-dots')
    const total = round.fruits.length
    const done = total - this.sortRemaining.length
    for (let i = 0; i < total; i++) {
      dots.appendChild(el('div', i < done ? 'dot done' : i === done ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)
  }

  private renderShop() {
    if (!this.shopData) return
    this.root.innerHTML = ''

    const available = this.shopData.items.filter(i => !this.shopBasket.includes(i.fruit))
    const cheapest = available.length > 0 ? Math.min(...available.map(i => i.price)) : Infinity
    const canBuyMore = this.shopBudget >= cheapest

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">🪙 ${this.shopBudget} coins</div>
      <div class="hud-right">🧺 ${this.shopBasket.length}</div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    hint.textContent = !canBuyMore && this.shopBasket.length > 0
      ? 'Great shopping! 🎉'
      : (this.shopData.goal || 'Drag fruits into the basket!')
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid')
    const items = this.shopData.items
    grid.style.gridTemplateColumns = `repeat(${items.length <= 4 ? 2 : items.length <= 6 ? 3 : 4}, 1fr)`

    items.forEach((item, i) => {
      const bought = this.shopBasket.includes(item.fruit)
      const canAfford = this.shopBudget >= item.price
      const card = el('div', 'fruit-card shop-item' + (bought ? ' is-bought' : '') + (!canAfford && !bought ? ' is-expensive' : ''))
      card.style.animationDelay = `${i * 0.07}s`

      const inner = el('div', 'fruit-inner')
      const svgWrap = el('div', 'fruit-svg')
      svgWrap.innerHTML = getFruitSvg(item.fruit)
      inner.appendChild(svgWrap)
      const label = el('span', 'fruit-label')
      label.textContent = item.fruit
      inner.appendChild(label)
      const price = el('span', 'shop-price')
      price.textContent = bought ? '✓ In basket' : `🪙 ${item.price}`
      inner.appendChild(price)
      card.appendChild(inner)

      if (!bought && canAfford) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handleBuy(item))
        card.style.touchAction = 'none'
        card.addEventListener('pointerdown', (e) => this.startDrag(e, item.fruit, card, '.basket-drop-zone', () => this.handleBuy(item)))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    // Basket drop zone
    const dropZone = el('div', 'basket-drop-zone')
    const basketIcon = el('div', 'basket-icon')
    basketIcon.innerHTML = basketSvg
    dropZone.appendChild(basketIcon)
    if (this.shopBasket.length > 0) {
      const basketItems = el('div', 'basket-items')
      this.shopBasket.forEach(fruit => {
        const mini = el('span', 'shop-basket-svg')
        mini.innerHTML = getFruitSvg(fruit)
        basketItems.appendChild(mini)
      })
      dropZone.appendChild(basketItems)
    } else {
      const dropLabel = el('div', 'basket-drop-label')
      dropLabel.textContent = 'Drag fruits here!'
      dropZone.appendChild(dropLabel)
    }
    this.root.appendChild(dropZone)

    if (this.shopBasket.length > 0) {
      if (!canBuyMore) {
        this.advanceTimer = window.setTimeout(() => this.advance(), 2500)
      } else {
        const btn = el('button', 'shop-done-btn')
        btn.textContent = 'Done Shopping 🛒'
        btn.addEventListener('click', () => this.advance())
        this.root.appendChild(btn)
      }
    }
  }

  private renderRecipe() {
    const recipe = this.recipes[this.recipeIdx]
    if (!recipe) return
    this.root.innerHTML = ''

    const got = this.recipeBasket.filter(f => recipe.required.includes(f))
    const allDone = got.length >= recipe.required.length

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">🪙 ${this.recipeBudget} coins</div>
      <div class="hud-right">${this.recipes.length > 1 ? `${this.recipeIdx + 1}/${this.recipes.length}` : ''}</div>
    `
    this.root.appendChild(hud)

    // Recipe card
    const recipeCard = el('div', 'recipe-card')
    let ingHtml = ''
    recipe.required.forEach(f => {
      const done = got.includes(f)
      ingHtml += `<span class="recipe-ing ${done ? 'recipe-ing-done' : ''}"><span class="recipe-ing-svg">${getFruitSvg(f)}</span></span>`
    })
    recipeCard.innerHTML = `
      <div class="recipe-title">${recipe.emoji || '📝'} ${recipe.name}</div>
      <div class="recipe-ingredients">${ingHtml}</div>
    `
    this.root.appendChild(recipeCard)

    const hint = el('div', 'challenge-hint')
    hint.textContent = allDone ? 'Recipe complete! 🎉' : 'Buy the ingredients!'
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid')
    const items = recipe.available
    grid.style.gridTemplateColumns = `repeat(${items.length <= 4 ? 2 : items.length <= 6 ? 3 : 4}, 1fr)`

    items.forEach((item, i) => {
      const bought = this.recipeBasket.includes(item.fruit)
      const canAfford = this.recipeBudget >= item.price
      const isRequired = recipe.required.includes(item.fruit)
      const card = el('div', 'fruit-card shop-item' + (bought ? ' is-bought' : '') + (!canAfford && !bought ? ' is-expensive' : ''))
      card.style.animationDelay = `${i * 0.07}s`

      const inner = el('div', 'fruit-inner')
      if (isRequired && !bought) inner.classList.add('recipe-required')
      const svgWrap = el('div', 'fruit-svg')
      svgWrap.innerHTML = getFruitSvg(item.fruit)
      inner.appendChild(svgWrap)
      const label = el('span', 'fruit-label')
      label.textContent = item.fruit
      inner.appendChild(label)
      const price = el('span', 'shop-price')
      price.textContent = bought ? '✓' : `🪙 ${item.price}`
      inner.appendChild(price)
      card.appendChild(inner)

      if (!bought && canAfford) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handleRecipeBuy(item))
        card.style.touchAction = 'none'
        card.addEventListener('pointerdown', (e) => this.startDrag(e, item.fruit, card, '.basket-drop-zone', () => this.handleRecipeBuy(item)))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    // Basket drop zone
    const dropZone = el('div', 'basket-drop-zone')
    const basketIcon = el('div', 'basket-icon')
    basketIcon.innerHTML = basketSvg
    dropZone.appendChild(basketIcon)
    if (this.recipeBasket.length > 0) {
      const basketItems = el('div', 'basket-items')
      this.recipeBasket.forEach(fruit => {
        const mini = el('span', 'shop-basket-svg')
        mini.innerHTML = getFruitSvg(fruit)
        basketItems.appendChild(mini)
      })
      dropZone.appendChild(basketItems)
    } else {
      const dropLabel = el('div', 'basket-drop-label')
      dropLabel.textContent = 'Drag ingredients here!'
      dropZone.appendChild(dropLabel)
    }
    this.root.appendChild(dropZone)

    if (allDone) {
      this.advanceTimer = window.setTimeout(() => this.advance(), 2000)
    }
  }

  // ===================== Drag & Drop =====================

  private startDrag(e: PointerEvent, fruit: string, card: HTMLElement, dropSelector: string, onDrop: (target: HTMLElement) => void) {
    if (this.dragEl) return
    card.setPointerCapture(e.pointerId)

    const startX = e.clientX, startY = e.clientY
    const rect = card.getBoundingClientRect()
    this.dragOffsetX = e.clientX - rect.left
    this.dragOffsetY = e.clientY - rect.top
    let dragging = false

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 8) {
        dragging = true
        const ghost = el('div', 'drag-ghost')
        ghost.innerHTML = getFruitSvg(fruit)
        ghost.style.width = `${rect.width * 0.8}px`
        ghost.style.height = `${rect.width * 0.8}px`
        document.body.appendChild(ghost)
        this.dragEl = ghost
        this.dragFruit = fruit
        card.classList.add('is-dragging')
        sfxPop()
      }
      if (dragging && this.dragEl) {
        ev.preventDefault()
        this.dragEl.style.left = `${ev.clientX - this.dragOffsetX}px`
        this.dragEl.style.top = `${ev.clientY - this.dragOffsetY}px`
        this.root.querySelectorAll<HTMLElement>(dropSelector).forEach(dz => {
          const r = dz.getBoundingClientRect()
          dz.classList.toggle('drop-hover', ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom)
        })
      }
    }

    const onEnd = (ev: PointerEvent) => {
      card.removeEventListener('pointermove', onMove)
      card.removeEventListener('pointerup', onEnd)
      card.removeEventListener('pointercancel', onEnd)
      card.classList.remove('is-dragging')
      if (dragging) {
        this.root.querySelectorAll<HTMLElement>(dropSelector).forEach(dz => {
          const r = dz.getBoundingClientRect()
          const over = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
          dz.classList.remove('drop-hover')
          if (over) onDrop(dz)
        })
      }
      if (this.dragEl) { this.dragEl.remove(); this.dragEl = null }
      this.dragFruit = null
    }

    card.addEventListener('pointermove', onMove)
    card.addEventListener('pointerup', onEnd)
    card.addEventListener('pointercancel', onEnd)
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
      let bonus = 0
      if (this.timerEnabled) {
        const elapsed = Date.now() - this.timerStart
        bonus = Math.max(0, Math.ceil((1 - elapsed / this.timerDuration) * 5))
        this.score += bonus
      }
      this.streak++
      card.classList.add('is-correct')
      sfxCorrect()
      setTimeout(() => sfxCoin(), 350)
      this.burstParticles(card)
      this.floatScore(card, bonus > 0 ? `+${10 + bonus}` : '+10')
      this.updateHUD()

      // Remove shadow/describe mode on correct to reveal
      const grid = this.root.querySelector('.fruit-grid')
      if (grid) { grid.classList.remove('shadow-mode', 'describe-mode') }

      this.root.querySelectorAll<HTMLElement>('.fruit-card').forEach(c => {
        if (c !== card) c.classList.add('is-dimmed')
      })

      this.bridge.emitEvent('correctAnswer', {
        challengeIndex: this.idx, expected: c.fruit, given: fruitName, score: this.score,
      })
      this.sync()
      clearTimeout(this.advanceTimer)
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

      if (this.wrongAttempts >= 3) this.doReveal()
    }
  }

  private doReveal() {
    if (this.answered) return
    this.answered = true
    const c = this.challenges[this.idx]
    if (!c) return
    sfxWhoosh()
    clearTimeout(this.advanceTimer)

    const grid = this.root.querySelector('.fruit-grid')
    if (grid) { grid.classList.remove('shadow-mode', 'describe-mode') }

    const pool = c.pool || []
    const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
    pool.forEach((name, i) => {
      if (name.toLowerCase() === c.fruit.toLowerCase()) cards[i]?.classList.add('is-revealed')
      else cards[i]?.classList.add('is-dimmed')
    })

    this.sync()
    this.advanceTimer = window.setTimeout(() => this.advance(), 2200)
  }

  private initSortRound() {
    const round = this.sortRounds[this.sortIdx]
    if (!round) return
    this.sortRemaining = [...round.fruits].sort(() => Math.random() - 0.5)
    this.sortSelected = null
  }

  private handleSort(fruitName: string, category: SortCategory) {
    const isCorrect = category.fruits.some(f => f.toLowerCase() === fruitName.toLowerCase())
    if (isCorrect) {
      const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
      const ci = this.sortRemaining.indexOf(fruitName)
      if (ci >= 0 && cards[ci]) {
        cards[ci].classList.add('is-correct')
        this.burstParticles(cards[ci])
        this.floatScore(cards[ci], '+5')
      }
      this.sortRemaining = this.sortRemaining.filter(f => f !== fruitName)
      this.score += 5; this.sortSelected = null
      sfxCorrect(); setTimeout(() => sfxCoin(), 200)
      this.updateHUD()
      this.bridge.emitEvent('correctSort', { fruit: fruitName, category: category.name, score: this.score })
      if (this.sortRemaining.length === 0) {
        this.bridge.emitEvent('sortRoundComplete', { round: this.sortIdx, score: this.score })
        this.advanceTimer = window.setTimeout(() => this.advance(), 1500)
      }
      setTimeout(() => { this.rerender = true; this.renderSort(); this.rerender = false }, 450)
    } else {
      sfxWrong()
      const bins = this.root.querySelectorAll('.sort-bin')
      const round = this.sortRounds[this.sortIdx]
      if (round) {
        const catIdx = round.categories.indexOf(category)
        if (catIdx >= 0 && bins[catIdx]) {
          bins[catIdx].classList.add('is-wrong')
          setTimeout(() => bins[catIdx].classList.remove('is-wrong'), 500)
        }
      }
      this.bridge.emitEvent('incorrectSort', { fruit: fruitName, category: category.name })
    }
    this.sync()
  }

  private doSortReveal() {
    const round = this.sortRounds[this.sortIdx]
    if (!round || this.sortRemaining.length === 0) return
    const fruit = this.sortSelected || this.sortRemaining[0]
    const cat = round.categories.find(c => c.fruits.some(f => f.toLowerCase() === fruit.toLowerCase()))
    if (!cat) return

    sfxWhoosh()
    this.sortSelected = fruit
    this.rerender = true; this.renderSort(); this.rerender = false

    const bins = this.root.querySelectorAll('.sort-bin')
    const catIdx = round.categories.indexOf(cat)
    if (catIdx >= 0 && bins[catIdx]) bins[catIdx].classList.add('is-revealed')
    this.advanceTimer = window.setTimeout(() => this.handleSort(fruit, cat), 1500)
  }

  private initMemoryRound() {
    const round = this.memoryRounds[this.memoryIdx]
    if (!round) return
    const cards: { fruit: string; id: number }[] = []
    round.fruits.forEach((fruit, i) => {
      cards.push({ fruit, id: i * 2 })
      cards.push({ fruit, id: i * 2 + 1 })
    })
    this.memoryCards = cards.sort(() => Math.random() - 0.5)
    this.memoryFlipped = []
    this.memoryMatched = new Set()
    this.memoryLocked = false
  }

  private handleMemoryFlip(cardId: number) {
    if (this.memoryLocked || this.memoryFlipped.includes(cardId) || this.memoryMatched.has(cardId)) return
    this.memoryFlipped.push(cardId)
    sfxPop()
    this.renderMemory()

    if (this.memoryFlipped.length === 2) {
      this.memoryLocked = true
      const [id1, id2] = this.memoryFlipped
      const c1 = this.memoryCards.find(c => c.id === id1)!
      const c2 = this.memoryCards.find(c => c.id === id2)!

      if (c1.fruit === c2.fruit) {
        this.memoryMatched.add(id1)
        this.memoryMatched.add(id2)
        this.score += 10
        this.memoryFlipped = []
        this.memoryLocked = false
        sfxCorrect(); setTimeout(() => sfxCoin(), 200)
        this.bridge.emitEvent('memoryMatch', { fruit: c1.fruit, matched: this.memoryMatched.size / 2, total: this.memoryCards.length / 2, score: this.score })

        if (this.memoryMatched.size === this.memoryCards.length) {
          this.bridge.emitEvent('memoryRoundComplete', { round: this.memoryIdx, score: this.score })
          this.advanceTimer = window.setTimeout(() => this.advance(), 1200)
        }
        this.renderMemory()
        this.sync()
      } else {
        sfxWrong()
        this.bridge.emitEvent('memoryMiss', { fruit1: c1.fruit, fruit2: c2.fruit })
        setTimeout(() => {
          this.memoryFlipped = []
          this.memoryLocked = false
          this.renderMemory()
        }, 1000)
      }
    }
  }

  private handleOddPick(fruit: string) {
    if (this.oddAnswered) return
    const round = this.oddRounds[this.oddIdx]
    if (!round) return

    this.oddAnswered = true
    const isCorrect = fruit.toLowerCase() === round.odd.toLowerCase()

    if (isCorrect) {
      this.score += 10; this.streak++
      sfxCorrect(); setTimeout(() => sfxCoin(), 200)
      this.bridge.emitEvent('oddCorrect', { round: this.oddIdx, odd: round.odd, score: this.score })
      const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
      const idx = round.fruits.findIndex(f => f.toLowerCase() === fruit.toLowerCase())
      if (idx >= 0 && cards[idx]) { this.burstParticles(cards[idx]); this.floatScore(cards[idx], '+10') }
    } else {
      this.streak = 0; sfxWrong()
      this.bridge.emitEvent('oddWrong', { round: this.oddIdx, picked: fruit, odd: round.odd })
    }
    this.renderOddOneOut()
    this.sync()
    this.advanceTimer = window.setTimeout(() => this.advance(), 2000)
  }

  private doOddReveal() {
    if (this.oddAnswered) return
    this.oddAnswered = true; sfxWhoosh()
    this.renderOddOneOut(); this.sync()
    this.advanceTimer = window.setTimeout(() => this.advance(), 2200)
  }

  private handlePatternPick(fruit: string) {
    if (this.patternAnswered) return
    const round = this.patternRounds[this.patternIdx]
    if (!round) return

    this.patternAnswered = true
    const isCorrect = fruit.toLowerCase() === round.answer.toLowerCase()

    if (isCorrect) {
      this.score += 10; this.streak++
      sfxCorrect(); setTimeout(() => sfxCoin(), 200)
      this.bridge.emitEvent('patternCorrect', { round: this.patternIdx, answer: round.answer, score: this.score })
      const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
      const idx = round.options.findIndex(f => f.toLowerCase() === fruit.toLowerCase())
      if (idx >= 0 && cards[idx]) { this.burstParticles(cards[idx]); this.floatScore(cards[idx], '+10') }
    } else {
      this.streak = 0; sfxWrong()
      this.bridge.emitEvent('patternWrong', { round: this.patternIdx, picked: fruit, answer: round.answer })
    }
    this.renderPattern()
    this.sync()
    this.advanceTimer = window.setTimeout(() => this.advance(), 2000)
  }

  private doPatternReveal() {
    if (this.patternAnswered) return
    this.patternAnswered = true; sfxWhoosh()
    this.renderPattern(); this.sync()
    this.advanceTimer = window.setTimeout(() => this.advance(), 2200)
  }

  private handleBuy(item: ShopItem) {
    if (this.shopBasket.includes(item.fruit) || this.shopBudget < item.price) return
    clearTimeout(this.advanceTimer)
    this.shopBasket.push(item.fruit)
    this.shopBudget -= item.price
    this.score += 5
    sfxCoin()
    this.bridge.emitEvent('itemBought', { fruit: item.fruit, price: item.price, budget: this.shopBudget, basket: [...this.shopBasket] })
    this.renderShop()
    this.sync()
  }

  private handleRecipeBuy(item: ShopItem) {
    if (this.recipeBasket.includes(item.fruit) || this.recipeBudget < item.price) return
    clearTimeout(this.advanceTimer)
    this.recipeBasket.push(item.fruit)
    this.recipeBudget -= item.price
    const recipe = this.recipes[this.recipeIdx]
    const isRequired = recipe?.required.includes(item.fruit)
    this.score += isRequired ? 10 : 5
    sfxCoin()
    if (isRequired) setTimeout(() => sfxCorrect(), 200)
    this.bridge.emitEvent('recipeBuy', { fruit: item.fruit, price: item.price, budget: this.recipeBudget, required: isRequired })
    this.renderRecipe()
    this.sync()
  }

  private finish() {
    clearTimeout(this.advanceTimer)
    sfxComplete()
    this.bridge.emitEvent('gameCompleted', { score: this.score, total: this.challenges.length })
    this.bridge.endGame({ outcome: 'completed', finalScore: this.score })

    const maxScore = this.challenges.length * 10
      + this.sortRounds.reduce((sum, r) => sum + r.fruits.length * 5, 0)
      + (this.shopData?.items.length ?? 0) * 5
      + this.memoryRounds.reduce((sum, r) => sum + r.fruits.length * 10, 0)
      + this.oddRounds.length * 10
      + this.patternRounds.length * 10
      + this.recipes.reduce((sum, r) => sum + r.required.length * 10, 0)

    this.root.innerHTML = ''
    const screen = el('div', 'end-screen')
    let details = ''
    if (this.streak >= 2) details += `<div class="end-detail">🔥 Best streak: ${this.streak}</div>`
    if (this.shopBasket.length > 0) details += `<div class="end-detail">🧺 Bought ${this.shopBasket.length} fruits</div>`
    if (this.memoryRounds.length > 0) details += `<div class="end-detail">🃏 Memory pairs matched!</div>`
    if (this.patternRounds.length > 0) details += `<div class="end-detail">🔢 Patterns completed!</div>`

    screen.innerHTML = `
      <div class="end-trophy">🏆</div>
      <h2 class="end-title">Great Job!</h2>
      <div class="end-score">
        <span class="end-star">★</span> ${this.score} <span class="end-max">/ ${maxScore}</span>
      </div>
      ${details}
    `
    this.root.appendChild(screen)
  }

  // ===================== Effects =====================

  private updateHUD() {
    const scoreEl = this.root.querySelector('.hud-score-val')
    if (scoreEl) {
      scoreEl.textContent = String(this.score)
      scoreEl.classList.remove('pulse')
      void (scoreEl as HTMLElement).offsetWidth
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
      p.style.left = `${cx}px`; p.style.top = `${cy}px`
      p.style.background = colors[i % colors.length]
      p.style.width = p.style.height = `${6 + Math.random() * 6}px`
      document.body.appendChild(p)
      p.addEventListener('animationend', () => p.remove())
    }
  }

  private floatScore(card: HTMLElement, text: string) {
    const rect = card.getBoundingClientRect()
    const f = document.createElement('div')
    f.className = 'float-score'
    f.textContent = text
    f.style.left = `${rect.left + rect.width / 2}px`
    f.style.top = `${rect.top}px`
    document.body.appendChild(f)
    f.addEventListener('animationend', () => f.remove())
  }

  private sync() { this.bridge.updateState(this.getState()) }
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
