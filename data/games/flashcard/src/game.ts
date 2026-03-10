import type { GameAPI } from '@learnfun/game-sdk'
import type { GameBridge } from '@learnfun/game-sdk'
import type { Card, Mode, Phase, GameState, GameCtx } from './types'
import { POINTS_CORRECT, SPEED_TIMER_MS, ALL_MINI_GAMES } from './constants'
import { clamp, shuffle } from './utils'
import { sfxWhoosh } from './audio'
import { renderLearn } from './phases/learn'
import { renderQuiz } from './phases/quiz'
import { renderSpeed } from './phases/speed'
import { renderMatch, generateMatchCards } from './phases/match'
import { renderEnd } from './phases/end'

export class FlashcardGame implements GameAPI {
  private root: HTMLElement
  private bridge: GameBridge
  private state: GameState
  private ctx: GameCtx

  constructor(root: HTMLElement, bridge: GameBridge) {
    this.root = root
    this.bridge = bridge
    this.state = this.defaultState()
    this.ctx = {
      root,
      bridge,
      s: this.state,
      render: () => this.render(),
      sync: () => this.sync(),
      advance: () => this.advanceInPhase(),
      checkAnswer: (v) => this.checkAnswer(v),
    }
  }

  init(data: unknown) {
    const d = data as Record<string, unknown>
    const cards = (d.cards as Card[]) || []
    const mode = (d.sub_type as Mode) || 'SentenceCompletion'

    // Reset all state
    Object.assign(this.state, this.defaultState())
    this.state.mode = mode
    this.state.cards = cards
    this.state.miniGames = shuffle([...ALL_MINI_GAMES])

    for (const card of cards) {
      this.state.mastery[String(card.id)] = 0
    }

    this.bridge.emitEvent('gameStarted', { mode, total: cards.length })
    this.render()
    this.sync()
  }

  handleAction(name: string, params: Record<string, unknown>) {
    const s = this.state
    const actions: Record<string, () => void> = {
      submit: () => {
        this.checkAnswer(String(params.value ?? ''))
        this.render()
        this.sync()
      },
      next: () => this.advanceInPhase(),
      reveal: () => {
        if (s.phase === 'quiz' || s.phase === 'speed') {
          s.answered = true
          s.wasCorrect = null
          this.clearSpeedTimer()
          this.render()
          this.sync()
        }
      },
      jump: () => {
        s.cardIndex = clamp(Number(params.to), 0, s.cards.length - 1)
        s.answered = false
        s.wasCorrect = null
        s.wrongAttempts = 0
        this.render()
        this.sync()
      },
      end: () => {
        this.clearTimers()
        s.phase = 'end'
        this.render()
        this.sync()
      },
      set: () => {
        if (String(params.field) === 'score') {
          s.score = Number(params.value)
          this.render()
          this.sync()
        }
      },
      _sync: () => {
        const incoming = params.state as Partial<GameState>
        // Preserve local timer IDs and per-player assets (score/streak)
        const { speedTimerId, advanceTimer, score, streak, bestStreak, totalCorrect, totalAnswered, ...rest } = incoming as GameState
        Object.assign(this.state, rest)
        this.render()
        // Followers don't sync back to avoid loops
      },
      _getFullState: () => {
        this.bridge.emitEvent('_fullState', { state: this.getFullState() })
      },
    }
    actions[name]?.()
  }

  getState() {
    const s = this.state
    const card = s.cards[s.cardIndex]
    return {
      phase: s.phase,
      mode: s.mode,
      cardIndex: s.cardIndex,
      score: s.score,
      total: s.cards.length,
      streak: s.streak,
      answered: s.answered,
      isComplete: s.phase === 'end',
      currentAnswer: card ? (card.answer ?? card.missing_word ?? '') : '',
      bestStreak: s.bestStreak,
      totalCorrect: s.totalCorrect,
      totalAnswered: s.totalAnswered,
      mastery: s.mastery,
    }
  }

  destroy() {
    this.clearTimers()
    this.root.innerHTML = ''
  }

  // --- Private ---

  private defaultState(): GameState {
    return {
      phase: 'learn',
      mode: 'SentenceCompletion',
      score: 0,
      streak: 0,
      bestStreak: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      cards: [],
      cardIndex: 0,
      answered: false,
      wasCorrect: null,
      wrongAttempts: 0,
      miniGames: [],
      miniGameIndex: 0,
      timerStart: 0,
      timerDuration: SPEED_TIMER_MS,
      speedTimerId: 0,
      matchCards: [],
      matchFlipped: [],
      matchMatched: [],
      matchLocked: false,
      mastery: {},
      advanceTimer: 0,
    }
  }

  private checkAnswer(value: string): boolean {
    const s = this.state
    if (s.answered || !value.trim()) return false
    if (s.phase !== 'quiz' && s.phase !== 'speed') return false
    this.bridge.emitEvent('_relay', { name: 'submit', params: { value } })

    const card = s.cards[s.cardIndex]
    if (!card) return false

    const correct = (card.answer ?? card.missing_word ?? '').trim().toLowerCase()
    const isCorrect = value.trim().toLowerCase() === correct

    s.answered = true
    s.wasCorrect = isCorrect
    s.totalAnswered++

    if (isCorrect) {
      s.totalCorrect++
      s.streak++
      s.bestStreak = Math.max(s.bestStreak, s.streak)
      s.mastery[String(card.id)] = (s.mastery[String(card.id)] || 0) + 1
      s.score += POINTS_CORRECT
    } else {
      s.streak = 0
      s.wrongAttempts++
      s.mastery[String(card.id)] = 0
    }

    this.bridge.emitEvent(isCorrect ? 'correctAnswer' : 'incorrectAnswer', {
      cardIndex: s.cardIndex,
      expected: correct,
      given: value.trim(),
      score: s.score,
    })

    return isCorrect
  }

  private render() {
    const renderers: Record<Phase, (ctx: GameCtx) => void> = {
      learn: renderLearn,
      quiz: renderQuiz,
      speed: renderSpeed,
      match: renderMatch,
      end: renderEnd,
    }
    renderers[this.state.phase](this.ctx)
  }

  getFullState(): GameState {
    return { ...this.state }
  }

  private sync() {
    this.bridge.updateState(this.getState())
    this.bridge.emitEvent('_fullState', { state: this.getFullState() })
  }

  private advanceInPhase() {
    this.bridge.emitEvent('_relay', { name: 'next', params: {} })
    const s = this.state
    clearTimeout(s.advanceTimer)
    s.advanceTimer = 0

    switch (s.phase) {
      case 'learn':
        if (s.cardIndex < s.cards.length - 1) {
          s.cardIndex++
        } else {
          s.phase = 'quiz'
          s.cardIndex = 0
          s.answered = false
          s.wasCorrect = null
          s.wrongAttempts = 0
          sfxWhoosh()
        }
        this.render()
        this.sync()
        break

      case 'quiz':
        if (s.cardIndex < s.cards.length - 1) {
          s.cardIndex++
          s.answered = false
          s.wasCorrect = null
          s.wrongAttempts = 0
          this.render()
          this.sync()
        } else {
          this.startMiniGame(0)
        }
        break

      case 'speed':
        this.clearSpeedTimer()
        if (s.cardIndex < s.cards.length - 1) {
          s.cardIndex++
          s.answered = false
          s.wasCorrect = null
          s.wrongAttempts = 0
          s.timerStart = Date.now()
          this.render()
          this.sync()
        } else {
          this.advanceToNextMiniGame()
        }
        break

      case 'match':
        this.advanceToNextMiniGame()
        break

      case 'end':
        break
    }
  }

  private startMiniGame(index: number) {
    const s = this.state

    if (index >= s.miniGames.length) {
      s.phase = 'end'
      this.render()
      this.sync()
      return
    }

    s.miniGameIndex = index
    const game = s.miniGames[index]

    if (game === 'speed') {
      s.phase = 'speed'
      s.cardIndex = 0
      s.answered = false
      s.wasCorrect = null
      s.wrongAttempts = 0
      s.cards = shuffle([...s.cards])
      s.timerStart = Date.now()
    } else if (game === 'match') {
      s.phase = 'match'
      generateMatchCards(this.ctx)
    }

    sfxWhoosh()
    this.render()
    this.sync()
  }

  private advanceToNextMiniGame() {
    this.startMiniGame(this.state.miniGameIndex + 1)
  }

  private clearSpeedTimer() {
    clearTimeout(this.state.speedTimerId)
    this.state.speedTimerId = 0
  }

  private clearTimers() {
    this.clearSpeedTimer()
    clearTimeout(this.state.advanceTimer)
    this.state.advanceTimer = 0
  }
}
