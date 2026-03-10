import type { GameBridge } from '@learnfun/game-sdk'

export interface Card {
  id: number | string
  image_data?: string
  answer?: string
  sentence_template?: string
  missing_word?: string
  options?: string[]
}

export type Mode = 'ImageToWord' | 'SentenceCompletion'
export type Phase = 'learn' | 'quiz' | 'speed' | 'match' | 'end'
export type MiniGame = 'speed' | 'match'

export interface MatchCard {
  id: string
  type: 'term' | 'definition'
  text: string
  pairId: string
  image?: string
}

export interface GameState {
  phase: Phase
  mode: Mode
  score: number
  streak: number
  bestStreak: number
  totalCorrect: number
  totalAnswered: number
  cards: Card[]
  cardIndex: number
  answered: boolean
  wasCorrect: boolean | null
  wrongAttempts: number
  miniGames: MiniGame[]
  miniGameIndex: number
  timerStart: number
  timerDuration: number
  speedTimerId: number
  matchCards: MatchCard[]
  matchFlipped: string[]
  matchMatched: string[]
  matchLocked: boolean
  mastery: Record<string, number>
  advanceTimer: number
}

export interface GameCtx {
  root: HTMLElement
  bridge: GameBridge
  s: GameState
  render: () => void
  sync: () => void
  advance: () => void
  checkAnswer: (value: string) => boolean
}
