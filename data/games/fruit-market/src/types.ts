import type { GameBridge } from '@learnfun/game-sdk'

export interface FruitInfo { title?: string; fact?: string; hint?: string; mode?: 'find' | 'shadow' | 'describe' }
export interface IntroItem { fruit: string; title?: string; fact?: string }
export interface Challenge { id: number | string; fruit: string; hint?: string; pool: string[]; mode?: 'find' | 'shadow' | 'describe' }
export interface SortCategory { name: string; emoji?: string; fruits: string[] }
export interface SortRound { fruits: string[]; categories: SortCategory[] }
export interface ShopItem { fruit: string; price: number }
export interface MemoryRound { fruits: string[] }
export interface OddOneOutRound { fruits: string[]; odd: string; trait: string; explanation?: string }
export interface PatternRound { sequence: string[]; answer: string; options: string[] }
export interface DrinkRecipe { name: string; drink: string; fruits: string[] }

export type MiniGame = 'memory' | 'oddoneout' | 'pattern' | 'sort' | 'juice'
export type Phase = 'learn' | 'play' | MiniGame | 'shop'

export interface GameState {
  isFollower: boolean
  phase: Phase
  wave: number
  coins: number
  score: number
  streak: number
  learnedFruits: string[]
  waveFruits: string[]
  waveGames: MiniGame[]
  gameIdx: number
  playedGames: MiniGame[]
  allFruits: Record<string, FruitInfo>
  fruitPrice: number
  // learn
  intro: IntroItem[]
  introIdx: number
  // play
  challenges: Challenge[]
  idx: number
  answered: boolean
  wrongAttempts: number
  advanceTimer: number
  // timer
  timerEnabled: boolean
  timerDuration: number
  timerStart: number
  // sort
  sortRounds: SortRound[]
  sortIdx: number
  sortRemaining: string[]
  sortSelected: string | null
  // shop
  shopBasket: string[]
  // memory
  memoryRounds: MemoryRound[]
  memoryIdx: number
  memoryCards: { fruit: string; id: number }[]
  memoryFlipped: number[]
  memoryMatched: Set<number>
  memoryLocked: boolean
  // oddoneout
  oddRounds: OddOneOutRound[]
  oddIdx: number
  oddAnswered: boolean
  // pattern
  patternRounds: PatternRound[]
  patternIdx: number
  patternAnswered: boolean
  // juice
  juiceRecipe: DrinkRecipe | null
  juiceBasket: string[]
  // multiplayer
  peers: { id: string; name: string; score: number; phase: string | null }[]
}

export interface GameCtx {
  root: HTMLElement
  s: GameState
  bridge: GameBridge
  render(): void
  advance(): void
  sync(): void
  advanceToNextGame(): void
  finish(): void
}
