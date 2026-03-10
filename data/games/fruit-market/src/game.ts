import type { GameAPI } from '@learnfun/game-sdk'
import type { GameBridge } from '@learnfun/game-sdk'
import type { GameCtx, GameState, FruitInfo, MiniGame, Phase } from './types'
import { WAVE_SIZE, TOTAL_WAVES, FRUIT_PRICE, STARTER_FRUITS, ALL_MINI_GAMES } from './constants'
import { FRUIT_NAMES } from './fruits'
import { clamp, shuffle } from './utils'
import { updateHUD } from './ui'
import { sfxPop, sfxWhoosh } from './audio'

import { renderLearn } from './phases/learn'
import { renderPlay, handlePick, doReveal } from './phases/play'
import { renderMemory, handleMemoryFlip, initMemoryRound, generateMemoryRounds } from './phases/memory'
import { renderOddOneOut, handleOddPick, doOddReveal, generateOddRounds } from './phases/oddoneout'
import { renderPattern, handlePatternPick, doPatternReveal, generatePatternRounds } from './phases/pattern'
import { renderSort, handleSort as doSort, doSortReveal, initSortRound, generateSortRounds } from './phases/sort'
import { renderShop, handleBuy as doBuy } from './phases/shop'
import { renderJuice, handleJuicePick, initJuiceRound, getAvailableJuiceRecipes } from './phases/juice'
import { renderEnd } from './phases/end'

// ===================== Game =====================

export class FruitMarketGame implements GameAPI, GameCtx {
  bridge: GameBridge
  root: HTMLElement
  s: GameState

  constructor(root: HTMLElement, bridge: GameBridge) {
    this.root = root
    this.bridge = bridge
    this.s = createInitialState()
  }

  init(data: unknown) {
    const d = data as Record<string, unknown>
    this.s = createInitialState()
    this.s.allFruits = (d.fruits as Record<string, FruitInfo>) || {}
    this.s.fruitPrice = Number(d.fruitPrice) || FRUIT_PRICE
    this.s.timerEnabled = !!d.timed
    this.s.timerDuration = Number(d.timerDuration) || 10000

    const starters = (d.starterFruits as string[]) || STARTER_FRUITS
    this.s.waveFruits = starters.slice(0, WAVE_SIZE)
    this.buildWaveData()
    this.assignWaveGames()

    this.s.phase = 'learn'
    this.s.introIdx = 0
    this.render()
    this.sync()
    this.bridge.emitEvent('gameStarted', { total: TOTAL_WAVES * WAVE_SIZE, phase: 'learn' })
  }

  handleAction(name: string, params: Record<string, unknown>) {
    const actions: Record<string, () => void> = {
      submit: () => {
        const val = String(params.value ?? '')
        if (this.s.phase === 'play') {
          const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
          const c = this.s.challenges[this.s.idx]
          if (!c) return
          const i = (c.pool || []).findIndex(f => f.toLowerCase() === val.toLowerCase())
          if (i >= 0 && cards[i]) handlePick(this, val, cards[i])
        }
        if (this.s.phase === 'sort') {
          const round = this.s.sortRounds[this.s.sortIdx]
          if (!round) return
          const cat = round.categories.find(c => c.fruits.some(f => f.toLowerCase() === val.toLowerCase()))
          const actual = this.s.sortRemaining.find(f => f.toLowerCase() === val.toLowerCase())
          if (cat && actual) { this.s.sortSelected = actual; doSort(this, actual, cat) }
        }
        if (this.s.phase === 'shop') {
          const fruit = FRUIT_NAMES.find(f => f.toLowerCase() === val.toLowerCase())
          if (fruit) doBuy(this, { fruit, price: this.s.fruitPrice })
        }
        if (this.s.phase === 'memory') {
          const idx = this.s.memoryCards.findIndex(c => c.fruit.toLowerCase() === val.toLowerCase() && !this.s.memoryMatched.has(c.id) && !this.s.memoryFlipped.includes(c.id))
          if (idx >= 0) handleMemoryFlip(this, this.s.memoryCards[idx].id)
        }
        if (this.s.phase === 'oddoneout') handleOddPick(this, val)
        if (this.s.phase === 'pattern') handlePatternPick(this, val)
        if (this.s.phase === 'juice') handleJuicePick(this, val)
      },
      next: () => this.advance(),
      reveal: () => {
        if (this.s.phase === 'play') doReveal(this)
        if (this.s.phase === 'sort') doSortReveal(this)
        if (this.s.phase === 'oddoneout') doOddReveal(this)
        if (this.s.phase === 'pattern') doPatternReveal(this)
      },
      jump: () => {
        const to = Number(params.to)
        if (this.s.phase === 'learn') this.s.introIdx = clamp(to, 0, this.s.intro.length - 1)
        else if (this.s.phase === 'play') {
          this.s.idx = clamp(to, 0, this.s.challenges.length - 1)
          this.s.answered = false; this.s.wrongAttempts = 0; clearTimeout(this.s.advanceTimer)
        } else if (this.s.phase === 'sort') { this.s.sortIdx = clamp(to, 0, this.s.sortRounds.length - 1); initSortRound(this) }
        else if (this.s.phase === 'memory') { this.s.memoryIdx = clamp(to, 0, this.s.memoryRounds.length - 1); initMemoryRound(this) }
        else if (this.s.phase === 'oddoneout') { this.s.oddIdx = clamp(to, 0, this.s.oddRounds.length - 1); this.s.oddAnswered = false }
        else if (this.s.phase === 'pattern') { this.s.patternIdx = clamp(to, 0, this.s.patternRounds.length - 1); this.s.patternAnswered = false }
        this.render()
      },
      end: () => this.finish(),
      set: () => {
        const field = String(params.field)
        if (field === 'score') { this.s.score = Number(params.value); this.s.coins = this.s.score; updateHUD(this.root, this.s.coins, this.s.streak) }
        if (field === 'phase') {
          const val = String(params.value) as Phase
          if (['play', 'learn', 'sort', 'shop', 'memory', 'oddoneout', 'pattern', 'juice'].includes(val)) {
            this.s.phase = val; this.render(); this.sync()
            this.bridge.emitEvent('phaseChange', { phase: val })
          }
        }
      },
    }
    actions[name]?.()
    this.sync()
  }

  getState() {
    const s = this.s
    const base = { wave: s.wave, coins: s.coins, score: s.score, learnedFruits: [...s.learnedFruits] }
    if (s.phase === 'learn') {
      const item = s.intro[s.introIdx]
      return { ...base, phase: 'learn' as const, introIndex: s.introIdx, introTotal: s.intro.length, currentFruit: item?.fruit ?? '' }
    }
    if (s.phase === 'memory') {
      return { ...base, phase: 'memory' as const, round: s.memoryIdx, total: s.memoryRounds.length, matched: s.memoryMatched.size / 2, pairs: s.memoryCards.length / 2 }
    }
    if (s.phase === 'oddoneout') {
      const r = s.oddRounds[s.oddIdx]
      return { ...base, phase: 'oddoneout' as const, round: s.oddIdx, total: s.oddRounds.length, trait: r?.trait ?? '', answered: s.oddAnswered }
    }
    if (s.phase === 'pattern') {
      return { ...base, phase: 'pattern' as const, round: s.patternIdx, total: s.patternRounds.length, answered: s.patternAnswered }
    }
    if (s.phase === 'sort') {
      return { ...base, phase: 'sort' as const, sortRound: s.sortIdx, sortTotal: s.sortRounds.length, remaining: s.sortRemaining.length }
    }
    if (s.phase === 'shop') {
      return { ...base, phase: 'shop' as const, budget: s.coins, basketSize: s.shopBasket.length, basket: [...s.shopBasket] }
    }
    if (s.phase === 'juice') {
      return { ...base, phase: 'juice' as const, recipe: s.juiceRecipe?.name ?? '', basket: [...s.juiceBasket], remaining: (s.juiceRecipe?.fruits.length ?? 0) - s.juiceBasket.length }
    }
    const c = s.challenges[s.idx]
    return {
      ...base, phase: 'play' as const, challengeIndex: s.idx, total: s.challenges.length,
      streak: s.streak, answered: s.answered, isComplete: s.idx >= s.challenges.length, currentFruit: c?.fruit ?? '',
    }
  }

  destroy() { clearTimeout(this.s.advanceTimer); this.root.innerHTML = '' }

  // ---- GameCtx methods ----

  render() {
    this.root.classList.remove('phase-active')
    switch (this.s.phase) {
      case 'learn': renderLearn(this); break
      case 'play': renderPlay(this); break
      case 'memory': renderMemory(this); break
      case 'oddoneout': renderOddOneOut(this); break
      case 'pattern': renderPattern(this); break
      case 'sort': renderSort(this); break
      case 'shop': renderShop(this); break
      case 'juice': renderJuice(this); break
    }
    setTimeout(() => this.root.classList.add('phase-active'), 600)
  }

  advance() {
    clearTimeout(this.s.advanceTimer)
    const s = this.s

    if (s.phase === 'learn') {
      if (s.introIdx < s.intro.length - 1) {
        s.introIdx++; sfxPop(); this.render(); this.sync()
        this.bridge.emitEvent('introAdvance', { index: s.introIdx, fruit: s.intro[s.introIdx]?.fruit })
      } else {
        s.phase = 'play'
        s.idx = 0; s.answered = false; s.wrongAttempts = 0
        sfxWhoosh(); this.render(); this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'play' })
      }
      return
    }

    if (s.phase === 'play') {
      if (s.idx < s.challenges.length - 1) {
        s.idx++; s.answered = false; s.wrongAttempts = 0
        this.render(); this.sync()
      } else {
        s.learnedFruits.push(...s.waveFruits)
        this.advanceToNextGame()
      }
      return
    }

    if (s.phase === 'memory') {
      if (s.memoryIdx < s.memoryRounds.length - 1) {
        s.memoryIdx++; initMemoryRound(this); this.render(); this.sync()
      } else { this.advanceToNextGame() }
      return
    }

    if (s.phase === 'oddoneout') {
      if (s.oddIdx < s.oddRounds.length - 1) {
        s.oddIdx++; s.oddAnswered = false; this.render(); this.sync()
      } else { this.advanceToNextGame() }
      return
    }

    if (s.phase === 'pattern') {
      if (s.patternIdx < s.patternRounds.length - 1) {
        s.patternIdx++; s.patternAnswered = false; this.render(); this.sync()
      } else { this.advanceToNextGame() }
      return
    }

    if (s.phase === 'sort') {
      if (s.sortIdx < s.sortRounds.length - 1) {
        s.sortIdx++; initSortRound(this); this.render(); this.sync()
      } else { this.advanceToNextGame() }
      return
    }

    if (s.phase === 'juice') {
      this.advanceToNextGame()
      return
    }

    if (s.phase === 'shop') {
      this.startNextWave()
      return
    }
  }

  advanceToNextGame() {
    const s = this.s
    if (s.gameIdx < s.waveGames.length) {
      const next = s.waveGames[s.gameIdx]
      s.gameIdx++
      this.transitionToMiniGame(next)
    } else if (s.wave < TOTAL_WAVES - 1) {
      s.shopBasket = []
      const needed = WAVE_SIZE * s.fruitPrice
      if (s.coins < needed) s.coins = needed
      s.phase = 'shop'
      sfxWhoosh(); this.render(); this.sync()
      this.bridge.emitEvent('phaseChange', { phase: 'shop' })
    } else {
      this.finish()
    }
  }

  finish() { renderEnd(this) }

  sync() { this.bridge.updateState(this.getState()) }

  // ---- Internal ----

  private transitionToMiniGame(game: MiniGame) {
    const s = this.s
    s.phase = game
    sfxWhoosh()
    clearTimeout(s.advanceTimer)
    if (game === 'memory') { s.memoryIdx = 0; initMemoryRound(this) }
    if (game === 'oddoneout') { s.oddIdx = 0; s.oddAnswered = false }
    if (game === 'pattern') { s.patternIdx = 0; s.patternAnswered = false }
    if (game === 'sort') { s.sortIdx = 0; initSortRound(this) }
    if (game === 'juice') { initJuiceRound(this) }
    this.render()
    this.sync()
    this.bridge.emitEvent('phaseChange', { phase: game })
  }

  private startNextWave() {
    const s = this.s
    s.waveFruits = [...s.shopBasket]
    s.shopBasket = []
    s.wave++
    this.buildWaveData()
    this.assignWaveGames()
    s.phase = 'learn'
    s.introIdx = 0
    sfxWhoosh(); this.render(); this.sync()
    this.bridge.emitEvent('phaseChange', { phase: 'learn' })
  }

  private buildWaveData() {
    const s = this.s
    s.intro = s.waveFruits.map(fruit => {
      const info = s.allFruits[fruit] || {}
      return {
        fruit,
        title: info.title || `Meet the ${fruit.charAt(0).toUpperCase() + fruit.slice(1)}!`,
        fact: info.fact || '',
      }
    })
    s.introIdx = 0

    s.challenges = s.waveFruits.map((fruit, i) => {
      const info = s.allFruits[fruit] || {}
      return {
        id: `w${s.wave}-${i}`,
        fruit,
        hint: info.hint || `Find the ${fruit}!`,
        pool: this.buildChallengePool(fruit),
        mode: info.mode,
      }
    })
    s.idx = 0; s.answered = false; s.wrongAttempts = 0

    const allKnown = [...s.learnedFruits, ...s.waveFruits]
    this.generateMiniGameData(allKnown)
  }

  private buildChallengePool(fruit: string): string[] {
    const others = FRUIT_NAMES.filter(f => f !== fruit)
    return shuffle([fruit, ...shuffle(others).slice(0, 5)])
  }

  private assignWaveGames() {
    const s = this.s
    const allKnown = s.learnedFruits.length + s.waveFruits.length

    const available = ALL_MINI_GAMES.filter(g => {
      if (g === 'oddoneout') return allKnown >= 4
      if (g === 'sort') return allKnown >= 6
      if (g === 'juice') return getAvailableJuiceRecipes(s.learnedFruits, s.waveFruits).length > 0
      return true
    })

    const unplayed = available.filter(g => !s.playedGames.includes(g))
    const picks = shuffle(unplayed).slice(0, 2)
    if (picks.length < 2) {
      const extras = shuffle(available.filter(g => !picks.includes(g)))
      picks.push(...extras.slice(0, 2 - picks.length))
    }

    s.waveGames = picks
    s.playedGames.push(...picks)
    s.gameIdx = 0
  }

  private generateMiniGameData(fruits: string[]) {
    const s = this.s
    s.memoryRounds = generateMemoryRounds(fruits); s.memoryIdx = 0
    s.patternRounds = generatePatternRounds(fruits); s.patternIdx = 0; s.patternAnswered = false
    s.oddRounds = generateOddRounds(fruits); s.oddIdx = 0; s.oddAnswered = false
    s.sortRounds = generateSortRounds(fruits); s.sortIdx = 0; s.sortRemaining = []; s.sortSelected = null
    if (s.sortRounds.length > 0) initSortRound(this)
  }
}

function createInitialState(): GameState {
  return {
    phase: 'learn',
    wave: 0, coins: 0, score: 0, streak: 0,
    learnedFruits: [], waveFruits: [], waveGames: [],
    gameIdx: 0, playedGames: [],
    allFruits: {}, fruitPrice: FRUIT_PRICE,
    intro: [], introIdx: 0,
    challenges: [], idx: 0, answered: false, wrongAttempts: 0, advanceTimer: 0,
    timerEnabled: false, timerDuration: 10000, timerStart: 0,
    sortRounds: [], sortIdx: 0, sortRemaining: [], sortSelected: null,
    shopBasket: [],
    memoryRounds: [], memoryIdx: 0, memoryCards: [], memoryFlipped: [], memoryMatched: new Set(), memoryLocked: false,
    oddRounds: [], oddIdx: 0, oddAnswered: false,
    patternRounds: [], patternIdx: 0, patternAnswered: false,
    juiceRecipe: null, juiceBasket: [],
  }
}
