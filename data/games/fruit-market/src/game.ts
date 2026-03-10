import type { GameAPI } from '@learnfun/game-sdk'
import { GameBridge } from '@learnfun/game-sdk'
import { getFruitSvg, getDrinkSvg, FRUIT_NAMES } from './fruits'
import basketSvg from './assets/basket.svg?raw'
import { sfxPop, sfxCorrect, sfxWrong, sfxCoin, sfxComplete, sfxWhoosh } from './audio'

// ===================== Types =====================

interface FruitInfo { title?: string; fact?: string; hint?: string; mode?: 'find' | 'shadow' | 'describe' }
interface IntroItem { fruit: string; title?: string; fact?: string }
interface Challenge { id: number | string; fruit: string; hint?: string; pool: string[]; mode?: 'find' | 'shadow' | 'describe' }
interface SortCategory { name: string; emoji?: string; fruits: string[] }
interface SortRound { fruits: string[]; categories: SortCategory[] }
interface ShopItem { fruit: string; price: number }
interface MemoryRound { fruits: string[] }
interface OddOneOutRound { fruits: string[]; odd: string; trait: string; explanation?: string }
interface PatternRound { sequence: string[]; answer: string; options: string[] }
interface DrinkRecipe { name: string; drink: string; fruits: string[] }

type MiniGame = 'memory' | 'oddoneout' | 'pattern' | 'sort' | 'juice'
type Phase = 'learn' | 'play' | MiniGame | 'shop'

// ===================== Constants =====================

const WAVE_SIZE = 3
const TOTAL_WAVES = 3
const FRUIT_PRICE = 10
const STARTER_FRUITS = ['apple', 'banana', 'orange']
const ALL_MINI_GAMES: MiniGame[] = ['memory', 'pattern', 'oddoneout', 'sort', 'juice']

const FRUIT_COLORS: Record<string, string> = {
  apple: 'red', cherry: 'red', strawberry: 'red',
  banana: 'yellow', lemon: 'yellow', pineapple: 'yellow',
  orange: 'orange', mango: 'orange', peach: 'orange',
  grape: 'purple', blueberry: 'purple',
  watermelon: 'green', kiwi: 'green', avocado: 'green', pear: 'green',
  coconut: 'brown',
}

const COLOR_EMOJIS: Record<string, string> = {
  red: '🔴', yellow: '🟡', orange: '🟠', purple: '🟣', green: '🟢', brown: '🟤',
}

const COLOR_NAMES: Record<string, string> = {
  red: 'Red', yellow: 'Yellow', orange: 'Orange', purple: 'Purple', green: 'Green', brown: 'Brown',
}

const DRINK_RECIPES: DrinkRecipe[] = [
  { name: 'Fruit Punch', drink: 'fruit-punch', fruits: ['apple', 'banana'] },
  { name: 'Apple Juice', drink: 'apple-juice', fruits: ['apple', 'lemon'] },
  { name: 'Tropical Smoothie', drink: 'tropical-smoothie', fruits: ['mango', 'pineapple', 'banana'] },
  { name: 'Berry Blast', drink: 'berry-blast', fruits: ['strawberry', 'blueberry', 'cherry'] },
  { name: 'Citrus Sunrise', drink: 'citrus-sunrise', fruits: ['orange', 'lemon', 'peach'] },
  { name: 'Green Machine', drink: 'green-machine', fruits: ['kiwi', 'avocado', 'pear'] },
  { name: 'Watermelon Cooler', drink: 'watermelon-cooler', fruits: ['watermelon', 'strawberry'] },
  { name: 'Coconut Paradise', drink: 'coconut-paradise', fruits: ['coconut', 'pineapple', 'mango'] },
  { name: 'Grape Fizz', drink: 'grape-fizz', fruits: ['grape', 'blueberry'] },
]

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

// ===================== Game =====================

export class FruitMarketGame implements GameAPI {
  private bridge: GameBridge
  private root: HTMLElement

  // Core flow
  private phase: Phase = 'learn'
  private wave = 0
  private coins = 0
  private score = 0
  private learnedFruits: string[] = []
  private waveFruits: string[] = []
  private waveGames: MiniGame[] = []
  private gameIdx = 0
  private playedGames: MiniGame[] = []

  // Fruit data
  private allFruits: Record<string, FruitInfo> = {}
  private fruitPrice = FRUIT_PRICE

  // Learn
  private intro: IntroItem[] = []
  private introIdx = 0

  // Play
  private challenges: Challenge[] = []
  private idx = 0
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

  // Juice
  private juiceRecipe: DrinkRecipe | null = null
  private juiceBasket: string[] = []

  constructor(root: HTMLElement, bridge: GameBridge) {
    this.root = root
    this.bridge = bridge
  }

  init(data: unknown) {
    const d = data as Record<string, unknown>
    this.allFruits = (d.fruits as Record<string, FruitInfo>) || {}
    this.fruitPrice = Number(d.fruitPrice) || FRUIT_PRICE
    this.timerEnabled = !!d.timed
    this.timerDuration = Number(d.timerDuration) || 10000

    this.wave = 0; this.coins = 0; this.score = 0; this.streak = 0
    this.learnedFruits = []; this.shopBasket = []; this.playedGames = []
    clearTimeout(this.advanceTimer)

    const starters = (d.starterFruits as string[]) || STARTER_FRUITS
    this.waveFruits = starters.slice(0, WAVE_SIZE)
    this.buildWaveData()
    this.assignWaveGames()

    this.phase = 'learn'
    this.introIdx = 0
    this.render()
    this.sync()
    this.bridge.emitEvent('gameStarted', { total: TOTAL_WAVES * WAVE_SIZE, phase: 'learn' })
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
          const fruit = FRUIT_NAMES.find(f => f.toLowerCase() === val.toLowerCase())
          if (fruit) this.handleBuy({ fruit, price: this.fruitPrice })
        }
        if (this.phase === 'memory') {
          const idx = this.memoryCards.findIndex(c => c.fruit.toLowerCase() === val.toLowerCase() && !this.memoryMatched.has(c.id) && !this.memoryFlipped.includes(c.id))
          if (idx >= 0) this.handleMemoryFlip(this.memoryCards[idx].id)
        }
        if (this.phase === 'oddoneout') this.handleOddPick(val)
        if (this.phase === 'pattern') this.handlePatternPick(val)
        if (this.phase === 'juice') this.handleJuicePick(val)
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
        if (this.phase === 'learn') this.introIdx = clamp(to, 0, this.intro.length - 1)
        else if (this.phase === 'play') {
          this.idx = clamp(to, 0, this.challenges.length - 1)
          this.answered = false; this.wrongAttempts = 0; clearTimeout(this.advanceTimer)
        } else if (this.phase === 'sort') { this.sortIdx = clamp(to, 0, this.sortRounds.length - 1); this.initSortRound() }
        else if (this.phase === 'memory') { this.memoryIdx = clamp(to, 0, this.memoryRounds.length - 1); this.initMemoryRound() }
        else if (this.phase === 'oddoneout') { this.oddIdx = clamp(to, 0, this.oddRounds.length - 1); this.oddAnswered = false }
        else if (this.phase === 'pattern') { this.patternIdx = clamp(to, 0, this.patternRounds.length - 1); this.patternAnswered = false }
        this.render()
      },
      end: () => this.finish(),
      set: () => {
        const field = String(params.field)
        if (field === 'score') { this.score = Number(params.value); this.coins = this.score; this.updateHUD() }
        if (field === 'phase') {
          const val = String(params.value) as Phase
          if (['play', 'learn', 'sort', 'shop', 'memory', 'oddoneout', 'pattern', 'juice'].includes(val)) {
            this.phase = val; this.render(); this.sync()
            this.bridge.emitEvent('phaseChange', { phase: val })
          }
        }
      },
    }
    actions[name]?.()
    this.sync()
  }

  getState() {
    const base = { wave: this.wave, coins: this.coins, score: this.score, learnedFruits: [...this.learnedFruits] }
    if (this.phase === 'learn') {
      const item = this.intro[this.introIdx]
      return { ...base, phase: 'learn' as const, introIndex: this.introIdx, introTotal: this.intro.length, currentFruit: item?.fruit ?? '' }
    }
    if (this.phase === 'memory') {
      return { ...base, phase: 'memory' as const, round: this.memoryIdx, total: this.memoryRounds.length, matched: this.memoryMatched.size / 2, pairs: this.memoryCards.length / 2 }
    }
    if (this.phase === 'oddoneout') {
      const r = this.oddRounds[this.oddIdx]
      return { ...base, phase: 'oddoneout' as const, round: this.oddIdx, total: this.oddRounds.length, trait: r?.trait ?? '', answered: this.oddAnswered }
    }
    if (this.phase === 'pattern') {
      return { ...base, phase: 'pattern' as const, round: this.patternIdx, total: this.patternRounds.length, answered: this.patternAnswered }
    }
    if (this.phase === 'sort') {
      return { ...base, phase: 'sort' as const, sortRound: this.sortIdx, sortTotal: this.sortRounds.length, remaining: this.sortRemaining.length }
    }
    if (this.phase === 'shop') {
      return { ...base, phase: 'shop' as const, budget: this.coins, basketSize: this.shopBasket.length, basket: [...this.shopBasket] }
    }
    if (this.phase === 'juice') {
      return { ...base, phase: 'juice' as const, recipe: this.juiceRecipe?.name ?? '', basket: [...this.juiceBasket], remaining: (this.juiceRecipe?.fruits.length ?? 0) - this.juiceBasket.length }
    }
    const c = this.challenges[this.idx]
    return {
      ...base, phase: 'play' as const, challengeIndex: this.idx, total: this.challenges.length,
      streak: this.streak, answered: this.answered, isComplete: this.idx >= this.challenges.length, currentFruit: c?.fruit ?? '',
    }
  }

  destroy() { clearTimeout(this.advanceTimer); this.root.innerHTML = '' }

  // ===================== Flow Control =====================

  private getFruitInfo(fruit: string): FruitInfo {
    return this.allFruits[fruit] || {}
  }

  private buildWaveData() {
    this.intro = this.waveFruits.map(fruit => {
      const info = this.getFruitInfo(fruit)
      return {
        fruit,
        title: info.title || `Meet the ${fruit.charAt(0).toUpperCase() + fruit.slice(1)}!`,
        fact: info.fact || '',
      }
    })
    this.introIdx = 0

    this.challenges = this.waveFruits.map((fruit, i) => ({
      id: `w${this.wave}-${i}`,
      fruit,
      hint: this.getFruitInfo(fruit).hint || `Find the ${fruit}!`,
      pool: this.buildChallengePool(fruit),
      mode: this.getFruitInfo(fruit).mode,
    }))
    this.idx = 0; this.answered = false; this.wrongAttempts = 0

    const allKnown = [...this.learnedFruits, ...this.waveFruits]
    this.generateMiniGameData(allKnown)
  }

  private buildChallengePool(fruit: string): string[] {
    const others = FRUIT_NAMES.filter(f => f !== fruit)
    return shuffle([fruit, ...shuffle(others).slice(0, 5)])
  }

  private assignWaveGames() {
    const allKnown = this.learnedFruits.length + this.waveFruits.length

    const available = ALL_MINI_GAMES.filter(g => {
      if (g === 'oddoneout') return allKnown >= 4
      if (g === 'sort') return allKnown >= 6
      if (g === 'juice') return this.getAvailableJuiceRecipes().length > 0
      return true
    })

    // Prioritize unplayed games so all mini-games appear across waves
    const unplayed = available.filter(g => !this.playedGames.includes(g))
    const picks = shuffle(unplayed).slice(0, 2)
    if (picks.length < 2) {
      const extras = shuffle(available.filter(g => !picks.includes(g)))
      picks.push(...extras.slice(0, 2 - picks.length))
    }

    this.waveGames = picks
    this.playedGames.push(...picks)
    this.gameIdx = 0
  }

  private advance() {
    clearTimeout(this.advanceTimer)

    if (this.phase === 'learn') {
      if (this.introIdx < this.intro.length - 1) {
        this.introIdx++; sfxPop(); this.render(); this.sync()
        this.bridge.emitEvent('introAdvance', { index: this.introIdx, fruit: this.intro[this.introIdx]?.fruit })
      } else {
        this.phase = 'play'
        this.idx = 0; this.answered = false; this.wrongAttempts = 0
        sfxWhoosh(); this.render(); this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'play' })
      }
      return
    }

    if (this.phase === 'play') {
      if (this.idx < this.challenges.length - 1) {
        this.idx++; this.answered = false; this.wrongAttempts = 0
        this.render(); this.sync()
      } else {
        this.learnedFruits.push(...this.waveFruits)
        this.advanceToNextGame()
      }
      return
    }

    if (this.phase === 'memory') {
      if (this.memoryIdx < this.memoryRounds.length - 1) {
        this.memoryIdx++; this.initMemoryRound(); this.render(); this.sync()
      } else { this.advanceToNextGame() }
      return
    }

    if (this.phase === 'oddoneout') {
      if (this.oddIdx < this.oddRounds.length - 1) {
        this.oddIdx++; this.oddAnswered = false; this.render(); this.sync()
      } else { this.advanceToNextGame() }
      return
    }

    if (this.phase === 'pattern') {
      if (this.patternIdx < this.patternRounds.length - 1) {
        this.patternIdx++; this.patternAnswered = false; this.render(); this.sync()
      } else { this.advanceToNextGame() }
      return
    }

    if (this.phase === 'sort') {
      if (this.sortIdx < this.sortRounds.length - 1) {
        this.sortIdx++; this.initSortRound(); this.render(); this.sync()
      } else { this.advanceToNextGame() }
      return
    }

    if (this.phase === 'juice') {
      this.advanceToNextGame()
      return
    }

    if (this.phase === 'shop') {
      this.startNextWave()
      return
    }
  }

  private advanceToNextGame() {
    if (this.gameIdx < this.waveGames.length) {
      const next = this.waveGames[this.gameIdx]
      this.gameIdx++
      this.transitionToMiniGame(next)
    } else if (this.wave < TOTAL_WAVES - 1) {
      this.shopBasket = []
      const needed = WAVE_SIZE * this.fruitPrice
      if (this.coins < needed) this.coins = needed
      this.phase = 'shop'
      sfxWhoosh(); this.render(); this.sync()
      this.bridge.emitEvent('phaseChange', { phase: 'shop' })
    } else {
      this.finish()
    }
  }

  private transitionToMiniGame(game: MiniGame) {
    this.phase = game
    sfxWhoosh()
    clearTimeout(this.advanceTimer)
    if (game === 'memory') { this.memoryIdx = 0; this.initMemoryRound() }
    if (game === 'oddoneout') { this.oddIdx = 0; this.oddAnswered = false }
    if (game === 'pattern') { this.patternIdx = 0; this.patternAnswered = false }
    if (game === 'sort') { this.sortIdx = 0; this.initSortRound() }
    if (game === 'juice') { this.initJuiceRound() }
    this.render()
    this.sync()
    this.bridge.emitEvent('phaseChange', { phase: game })
  }

  private startNextWave() {
    this.waveFruits = [...this.shopBasket]
    this.shopBasket = []
    this.wave++
    this.buildWaveData()
    this.assignWaveGames()
    this.phase = 'learn'
    this.introIdx = 0
    sfxWhoosh(); this.render(); this.sync()
    this.bridge.emitEvent('phaseChange', { phase: 'learn' })
  }

  // ===================== Dynamic Mini-Game Generation =====================

  private generateMiniGameData(fruits: string[]) {
    // Memory: 3-4 fruit pairs
    const memCount = Math.min(4, fruits.length)
    this.memoryRounds = [{ fruits: shuffle(fruits).slice(0, memCount) }]
    this.memoryIdx = 0

    // Pattern: ABAB
    this.patternRounds = []
    if (fruits.length >= 2) {
      const picked = shuffle(fruits)
      const a = picked[0], b = picked[1]
      const distractors = shuffle(fruits.filter(f => f !== a && f !== b)).slice(0, 1)
      const options = shuffle([a, b, ...distractors])
      if (!options.includes(a)) options[0] = a
      this.patternRounds = [{ sequence: [a, b, a, b], answer: a, options: shuffle(options) }]
    }
    this.patternIdx = 0; this.patternAnswered = false

    // OddOneOut: 3 same color + 1 different
    this.oddRounds = []
    if (fruits.length >= 4) {
      const groups: Record<string, string[]> = {}
      fruits.forEach(f => {
        const color = FRUIT_COLORS[f] || 'other'
        if (!groups[color]) groups[color] = []
        groups[color].push(f)
      })
      const bigGroups = Object.entries(groups).filter(([, fs]) => fs.length >= 3)
      if (bigGroups.length > 0) {
        const [trait, group] = shuffle(bigGroups)[0]
        const three = shuffle(group).slice(0, 3)
        const others = fruits.filter(f => !group.includes(f))
        if (others.length > 0) {
          const odd = shuffle(others)[0]
          const traitName = COLOR_NAMES[trait] || trait
          this.oddRounds = [{
            fruits: shuffle([...three, odd]),
            odd,
            trait: `${traitName.toLowerCase()} fruit`,
            explanation: `${odd.charAt(0).toUpperCase() + odd.slice(1)} is not ${traitName.toLowerCase()} — the rest are!`,
          }]
        }
      }
    }
    this.oddIdx = 0; this.oddAnswered = false

    // Sort: group by color, 2-3 bins
    this.sortRounds = []
    if (fruits.length >= 6) {
      const groups: Record<string, string[]> = {}
      fruits.forEach(f => {
        const color = FRUIT_COLORS[f] || 'other'
        if (!groups[color]) groups[color] = []
        groups[color].push(f)
      })
      const validGroups = Object.entries(groups).filter(([, fs]) => fs.length >= 2)
      if (validGroups.length >= 2) {
        const selected = shuffle(validGroups).slice(0, 3)
        const allFruits: string[] = []
        const categories: SortCategory[] = []
        selected.forEach(([color, fs]) => {
          const picked = shuffle(fs).slice(0, 2)
          allFruits.push(...picked)
          categories.push({
            name: `${COLOR_NAMES[color] || color} Fruits`,
            emoji: COLOR_EMOJIS[color] || '',
            fruits: picked,
          })
        })
        this.sortRounds = [{ fruits: allFruits, categories }]
      }
    }
    this.sortIdx = 0; this.sortRemaining = []; this.sortSelected = null
    if (this.sortRounds.length > 0) this.initSortRound()
  }

  private getAvailableJuiceRecipes(): DrinkRecipe[] {
    const known = [...this.learnedFruits, ...this.waveFruits]
    return DRINK_RECIPES.filter(r => r.fruits.every(f => known.includes(f)))
  }

  private initJuiceRound() {
    const available = this.getAvailableJuiceRecipes()
    this.juiceRecipe = available.length > 0 ? shuffle(available)[0] : null
    this.juiceBasket = []
  }

  // ===================== Render Helpers =====================

  private get streakHtml() {
    return this.streak >= 2 ? `<span class="hud-streak">🔥 ${this.streak}</span>` : ''
  }

  private renderHUD(center: string, right = '') {
    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">🪙</span> <span class="hud-score-val">${this.coins}</span></div>
      <div class="hud-center">${center}</div>
      <div class="hud-right">${right}</div>
    `
    this.root.appendChild(hud)
  }

  private makeFruitCard(fruit: string, i: number, extraClass = '', noAnim = false): HTMLElement {
    const card = el('div', 'fruit-card' + (extraClass ? ' ' + extraClass : ''))
    if (noAnim) card.style.animation = 'none'
    else card.style.animationDelay = `${i * 0.07}s`
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

  private renderDots(current: number, total: number) {
    const dots = el('div', 'progress-dots')
    for (let i = 0; i < total; i++) {
      dots.appendChild(el('div', i < current ? 'dot done' : i === current ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)
  }

  private awardPoints(amount: number, card?: HTMLElement) {
    this.coins += amount; this.score += amount
    sfxCorrect(); setTimeout(() => sfxCoin(), 200)
    if (card) { this.burstParticles(card); this.floatScore(card, `+${amount}`) }
    this.updateHUD()
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
      case 'juice': this.renderJuice(); break
    }
  }

  private renderIntro() {
    const item = this.intro[this.introIdx]
    if (!item) return
    this.root.innerHTML = ''

    const phaseLabel = el('div', 'phase-label')
    phaseLabel.textContent = `Wave ${this.wave + 1} of ${TOTAL_WAVES} — Let's learn!`
    this.root.appendChild(phaseLabel)

    const card = el('div', 'intro-card')
    card.innerHTML = `
      <div class="intro-svg">${getFruitSvg(item.fruit)}</div>
      <h2 class="intro-title">${item.title || item.fruit}</h2>
      ${item.fact ? `<p class="intro-fact">${item.fact}</p>` : ''}
    `
    card.style.cursor = 'pointer'
    card.addEventListener('click', () => this.advance())
    this.root.appendChild(card)

    this.renderDots(this.introIdx, this.intro.length)
  }

  private renderChallenge() {
    const c = this.challenges[this.idx]
    if (!c) return
    this.root.innerHTML = ''

    this.renderHUD(`Wave ${this.wave + 1}: ${this.idx + 1} / ${this.challenges.length}`, this.streakHtml)

    const hint = el('div', 'challenge-hint')
    if (c.mode === 'shadow') hint.textContent = c.hint || 'Can you guess by the shape?'
    else if (c.mode === 'describe') hint.textContent = c.hint || 'Which fruit matches this description?'
    else hint.textContent = c.hint || `Find the ${c.fruit}!`
    this.root.appendChild(hint)

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
    grid.style.gridTemplateColumns = `repeat(${gridCols(pool.length)}, 1fr)`

    pool.forEach((fruitName, i) => {
      const card = this.makeFruitCard(fruitName, i)
      if (!this.answered) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handlePick(fruitName, card))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    this.renderDots(this.idx, this.challenges.length)
  }

  private renderMemory() {
    this.root.innerHTML = ''
    const round = this.memoryRounds[this.memoryIdx]
    if (!round) return

    this.renderHUD(`Memory! ${this.memoryMatched.size / 2} / ${this.memoryCards.length / 2}`)

    const hint = el('div', 'challenge-hint')
    hint.textContent = 'Find the matching pairs!'
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid memory-grid')
    const total = this.memoryCards.length
    grid.style.gridTemplateColumns = `repeat(${total <= 8 ? 4 : total <= 12 ? 4 : 5}, 1fr)`

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

    this.renderDots(this.memoryMatched.size / 2, this.memoryCards.length / 2)
  }

  private renderOddOneOut() {
    const round = this.oddRounds[this.oddIdx]
    if (!round) return
    this.root.innerHTML = ''

    this.renderHUD(`Odd one out! ${this.oddIdx + 1} / ${this.oddRounds.length}`, this.streakHtml)

    const hint = el('div', 'challenge-hint')
    hint.textContent = `Which one is NOT a ${round.trait}?`
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid')
    grid.style.gridTemplateColumns = `repeat(${round.fruits.length <= 4 ? 2 : 3}, 1fr)`

    round.fruits.forEach((fruit, i) => {
      const isOdd = fruit.toLowerCase() === round.odd.toLowerCase()
      const extra = this.oddAnswered ? (isOdd ? 'is-correct' : 'is-dimmed') : ''
      const card = this.makeFruitCard(fruit, i, extra)
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

    this.renderDots(this.oddIdx, this.oddRounds.length)
  }

  private renderPattern() {
    const round = this.patternRounds[this.patternIdx]
    if (!round) return
    this.root.innerHTML = ''

    this.renderHUD(`Pattern! ${this.patternIdx + 1} / ${this.patternRounds.length}`, this.streakHtml)

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
      const extra = this.patternAnswered ? (isAnswer ? 'is-correct' : 'is-dimmed') : ''
      const card = this.makeFruitCard(fruit, i, extra)
      if (!this.patternAnswered) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handlePatternPick(fruit))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    this.renderDots(this.patternIdx, this.patternRounds.length)
  }

  private renderSort() {
    const round = this.sortRounds[this.sortIdx]
    if (!round) return
    this.root.innerHTML = ''

    this.renderHUD(
      `Sort! ${this.sortRemaining.length} left`,
      this.sortRounds.length > 1 ? `${this.sortIdx + 1}/${this.sortRounds.length}` : '',
    )

    const hint = el('div', 'challenge-hint')
    hint.textContent = this.sortSelected
      ? `Where does the ${this.sortSelected} go?`
      : 'Tap a fruit, then pick its bin — or drag!'
    if (this.rerender) hint.style.animation = 'none'
    this.root.appendChild(hint)

    // Category bins
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

    if (this.sortRemaining.length > 0) {
      const grid = el('div', 'fruit-grid')
      grid.style.gridTemplateColumns = `repeat(${gridCols(this.sortRemaining.length)}, 1fr)`

      this.sortRemaining.forEach((fruitName, i) => {
        const extra = fruitName === this.sortSelected ? 'is-selected' : ''
        const card = this.makeFruitCard(fruitName, i, extra, this.rerender)
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

    const done = round.fruits.length - this.sortRemaining.length
    this.renderDots(done, round.fruits.length)
  }

  private renderShop() {
    this.root.innerHTML = ''
    const unlearned = FRUIT_NAMES.filter(f => !this.learnedFruits.includes(f) && !this.shopBasket.includes(f))
    const remaining = WAVE_SIZE - this.shopBasket.length

    this.renderHUD(
      `Pick ${remaining} fruit${remaining !== 1 ? 's' : ''} to learn!`,
      `🧺 ${this.shopBasket.length}/${WAVE_SIZE}`,
    )

    const hint = el('div', 'challenge-hint')
    hint.textContent = this.shopBasket.length >= WAVE_SIZE
      ? 'Great choices! Let\'s learn about them! 🎉'
      : `Each fruit costs 🪙${this.fruitPrice} — choose wisely!`
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid')
    grid.style.gridTemplateColumns = `repeat(${gridCols(unlearned.length)}, 1fr)`

    unlearned.forEach((fruit, i) => {
      const canAfford = this.coins >= this.fruitPrice && this.shopBasket.length < WAVE_SIZE
      const card = this.makeFruitCard(fruit, i, 'shop-item' + (!canAfford ? ' is-expensive' : ''))
      const price = el('span', 'shop-price')
      price.textContent = `🪙 ${this.fruitPrice}`
      card.querySelector('.fruit-inner')!.appendChild(price)
      if (canAfford) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handleBuy({ fruit, price: this.fruitPrice }))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    if (this.shopBasket.length > 0) {
      const dropZone = el('div', 'basket-drop-zone')
      const basketIcon = el('div', 'basket-icon')
      basketIcon.innerHTML = basketSvg
      dropZone.appendChild(basketIcon)
      const basketItems = el('div', 'basket-items')
      this.shopBasket.forEach(fruit => {
        const mini = el('span', 'shop-basket-svg')
        mini.innerHTML = getFruitSvg(fruit)
        basketItems.appendChild(mini)
      })
      dropZone.appendChild(basketItems)
      this.root.appendChild(dropZone)
    }

    if (this.shopBasket.length >= WAVE_SIZE) {
      this.advanceTimer = window.setTimeout(() => this.advance(), 2000)
    }
  }

  private renderJuice() {
    if (!this.juiceRecipe) { this.advanceToNextGame(); return }
    this.root.innerHTML = ''

    const allDone = this.juiceRecipe.fruits.every(f => this.juiceBasket.includes(f))

    this.renderHUD('Make a drink!')

    const drinkCard = el('div', 'juice-card')
    const drinkSvg = getDrinkSvg(this.juiceRecipe.drink)
    let ingHtml = ''
    this.juiceRecipe.fruits.forEach(f => {
      const done = this.juiceBasket.includes(f)
      ingHtml += `<span class="recipe-ing ${done ? 'recipe-ing-done' : ''}"><span class="recipe-ing-svg">${getFruitSvg(f)}</span></span>`
    })
    drinkCard.innerHTML = `
      <div class="juice-drink">${drinkSvg}</div>
      <div class="juice-name">${this.juiceRecipe.name}</div>
      <div class="recipe-ingredients">${ingHtml}</div>
    `
    this.root.appendChild(drinkCard)

    const hint = el('div', 'challenge-hint')
    hint.textContent = allDone ? 'Delicious! 🎉' : 'Pick the right fruits to make the drink!'
    this.root.appendChild(hint)

    if (!allDone) {
      const pool = [...this.juiceRecipe.fruits]
      const distractors = shuffle(this.learnedFruits.filter(f => !pool.includes(f))).slice(0, 3)
      pool.push(...distractors)
      const shuffledPool = shuffle(pool)

      const grid = el('div', 'fruit-grid')
      grid.style.gridTemplateColumns = `repeat(${gridCols(shuffledPool.length)}, 1fr)`

      shuffledPool.forEach((fruit, i) => {
        const picked = this.juiceBasket.includes(fruit)
        const card = this.makeFruitCard(fruit, i, picked ? 'is-bought' : '')
        if (!picked) {
          card.addEventListener('pointerenter', () => sfxPop())
          card.addEventListener('click', () => this.handleJuicePick(fruit))
        }
        grid.appendChild(card)
      })
      this.root.appendChild(grid)
    }

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
      let bonus = 0
      if (this.timerEnabled) {
        const elapsed = Date.now() - this.timerStart
        bonus = Math.max(0, Math.ceil((1 - elapsed / this.timerDuration) * 5))
      }
      this.streak++
      card.classList.add('is-correct')
      this.awardPoints(10 + bonus, card)
      clearTimeout(this.advanceTimer)

      const grid = this.root.querySelector('.fruit-grid')
      if (grid) { grid.classList.remove('shadow-mode', 'describe-mode') }

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
      if (ci >= 0 && cards[ci]) cards[ci].classList.add('is-correct')
      this.sortRemaining = this.sortRemaining.filter(f => f !== fruitName)
      this.sortSelected = null
      this.awardPoints(5, ci >= 0 ? cards[ci] : undefined)
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
        this.memoryFlipped = []
        this.memoryLocked = false
        this.awardPoints(10)
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
      this.streak++
      const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
      const idx = round.fruits.findIndex(f => f.toLowerCase() === fruit.toLowerCase())
      this.awardPoints(10, idx >= 0 ? cards[idx] : undefined)
      this.bridge.emitEvent('oddCorrect', { round: this.oddIdx, odd: round.odd, score: this.score })
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
      this.streak++
      const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
      const idx = round.options.findIndex(f => f.toLowerCase() === fruit.toLowerCase())
      this.awardPoints(10, idx >= 0 ? cards[idx] : undefined)
      this.bridge.emitEvent('patternCorrect', { round: this.patternIdx, answer: round.answer, score: this.score })
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
    if (this.shopBasket.includes(item.fruit) || this.coins < item.price || this.shopBasket.length >= WAVE_SIZE) return
    clearTimeout(this.advanceTimer)
    this.shopBasket.push(item.fruit)
    this.coins -= item.price
    sfxCoin()
    this.bridge.emitEvent('itemBought', { fruit: item.fruit, price: item.price, budget: this.coins, basket: [...this.shopBasket] })
    this.renderShop()
    this.sync()
  }

  private handleJuicePick(fruit: string) {
    if (!this.juiceRecipe || this.juiceBasket.includes(fruit)) return
    const isCorrect = this.juiceRecipe.fruits.includes(fruit)

    if (isCorrect) {
      this.juiceBasket.push(fruit)
      const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
      const pool = [...this.root.querySelectorAll('.fruit-label')].map(l => l.textContent?.toLowerCase())
      const idx = pool.indexOf(fruit.toLowerCase())
      this.awardPoints(10, idx >= 0 ? cards[idx] : undefined)
      this.bridge.emitEvent('juiceCorrect', { fruit, recipe: this.juiceRecipe.name, score: this.score })
    } else {
      sfxWrong()
      this.bridge.emitEvent('juiceWrong', { fruit, recipe: this.juiceRecipe.name })

      const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
      const pool = [...this.root.querySelectorAll('.fruit-label')].map(l => l.textContent?.toLowerCase())
      const idx = pool.indexOf(fruit.toLowerCase())
      if (idx >= 0 && cards[idx]) {
        cards[idx].classList.add('is-wrong')
        setTimeout(() => cards[idx].classList.remove('is-wrong'), 500)
      }
    }
    this.renderJuice()
    this.sync()
  }

  private finish() {
    clearTimeout(this.advanceTimer)
    sfxComplete()
    this.bridge.emitEvent('gameCompleted', { score: this.score, coins: this.coins, learnedFruits: [...this.learnedFruits] })
    this.bridge.endGame({ outcome: 'completed', finalScore: this.score })

    this.root.innerHTML = ''
    const screen = el('div', 'end-screen')
    let details = ''
    details += `<div class="end-detail">🍎 Learned ${this.learnedFruits.length} fruits</div>`
    if (this.streak >= 2) details += `<div class="end-detail">🔥 Best streak: ${this.streak}</div>`

    screen.innerHTML = `
      <div class="end-trophy">🏆</div>
      <h2 class="end-title">Great Job!</h2>
      <div class="end-score">
        🪙 ${this.score} coins earned
      </div>
      ${details}
    `
    this.root.appendChild(screen)
  }

  // ===================== Effects =====================

  private updateHUD() {
    const scoreEl = this.root.querySelector('.hud-score-val')
    if (scoreEl) {
      scoreEl.textContent = String(this.coins)
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

function gridCols(n: number): number {
  return n <= 4 ? 2 : n <= 6 ? 3 : 4
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
