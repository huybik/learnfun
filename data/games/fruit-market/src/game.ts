import type { GameAPI } from '@learnfun/game-sdk'
import { GameBridge } from '@learnfun/game-sdk'
import { getFruitSvg } from './fruits'

interface Challenge {
  id: number | string
  fruit: string
  hint?: string
  options?: string[]   // identify mode: 4 text options
  pool?: string[]      // basket mode: 8 fruits shown in grid
}

type Mode = 'identify' | 'basket'

export class FruitMarketGame implements GameAPI {
  private bridge: GameBridge
  private root: HTMLElement
  private mode: Mode = 'identify'
  private challenges: Challenge[] = []
  private idx = 0
  private score = 0
  private answered = false
  private wasCorrect: boolean | null = null

  constructor(root: HTMLElement, bridge: GameBridge) {
    this.root = root
    this.bridge = bridge
  }

  init(data: unknown) {
    const d = data as Record<string, unknown>
    this.mode = (d.mode as Mode) || 'identify'
    this.challenges = (d.challenges as Challenge[]) || []
    this.idx = 0
    this.score = 0
    this.answered = false
    this.wasCorrect = null
    this.render()
    this.sync()
    this.bridge.emitEvent('gameStarted', { mode: this.mode, total: this.challenges.length })
  }

  handleAction(name: string, params: Record<string, unknown>) {
    const actions: Record<string, () => void> = {
      submit: () => this.checkAnswer(String(params.value ?? '')),
      next: () => this.advance(),
      reveal: () => { this.answered = true; this.wasCorrect = null; this.render() },
      jump: () => {
        this.idx = clamp(Number(params.to), 0, this.challenges.length - 1)
        this.answered = false
        this.wasCorrect = null
        this.render()
      },
      end: () => this.finish(),
      set: () => {
        const field = String(params.field)
        if (field === 'score') { this.score = Number(params.value); this.render() }
      },
    }
    actions[name]?.()
    this.sync()
  }

  getState() {
    const c = this.challenges[this.idx]
    return {
      mode: this.mode,
      challengeIndex: this.idx,
      score: this.score,
      total: this.challenges.length,
      answered: this.answered,
      isComplete: this.idx >= this.challenges.length,
      currentFruit: c?.fruit ?? '',
    }
  }

  destroy() {
    this.root.innerHTML = ''
  }

  // --- Internal ---

  private sync() {
    this.bridge.updateState(this.getState())
  }

  private checkAnswer(answer: string) {
    if (this.answered || !answer.trim()) return
    const c = this.challenges[this.idx]
    if (!c) return

    const correct = c.fruit.trim().toLowerCase()
    this.wasCorrect = answer.trim().toLowerCase() === correct
    this.answered = true
    if (this.wasCorrect) this.score += 10

    this.bridge.emitEvent(this.wasCorrect ? 'correctAnswer' : 'incorrectAnswer', {
      challengeIndex: this.idx,
      expected: correct,
      given: answer.trim(),
      score: this.score,
    })
    this.render()
    this.sync()
  }

  private advance() {
    if (this.idx < this.challenges.length - 1) {
      this.idx++
      this.answered = false
      this.wasCorrect = null
      this.render()
      this.sync()
    } else {
      this.finish()
    }
  }

  private finish() {
    this.bridge.emitEvent('gameCompleted', { score: this.score, total: this.challenges.length })
    this.bridge.endGame({ outcome: 'completed', finalScore: this.score })
    this.root.innerHTML = ''
    const div = h('div', 'completion')
    div.innerHTML = `<h2>Game Complete!</h2><p class="final-score">Score: ${this.score} / ${this.challenges.length * 10}</p>`
    this.root.appendChild(div)
  }

  private render() {
    const c = this.challenges[this.idx]
    if (!c) return
    this.root.innerHTML = ''

    // Header
    const header = h('div', 'header')
    header.innerHTML = `
      <span class="progress">Challenge ${this.idx + 1} / ${this.challenges.length}</span>
      <span class="score">Score: ${this.score}</span>
    `
    this.root.appendChild(header)

    if (this.mode === 'identify') {
      this.renderIdentify(c)
    } else {
      this.renderBasket(c)
    }
  }

  // --- Identify mode ---

  private renderIdentify(c: Challenge) {
    // Fruit display
    const display = h('div', 'fruit-display')
    const svgWrap = h('div', this.answered
      ? `fruit-svg ${this.wasCorrect === true ? 'anim-correct' : this.wasCorrect === false ? 'anim-incorrect' : ''}`
      : 'fruit-svg anim-bounce-in')
    svgWrap.innerHTML = getFruitSvg(c.fruit)
    display.appendChild(svgWrap)
    this.root.appendChild(display)

    // Hint
    if (c.hint) {
      const hint = h('p', 'hint')
      hint.textContent = c.hint
      this.root.appendChild(hint)
    }

    // Feedback
    if (this.answered) {
      this.renderFeedback(c)
      return
    }

    // Options or text input
    if (c.options?.length) {
      const opts = h('div', 'options')
      for (const opt of c.options) {
        const btn = h('button', 'option-btn')
        btn.textContent = opt
        btn.onclick = () => this.checkAnswer(opt)
        opts.appendChild(btn)
      }
      this.root.appendChild(opts)
    } else {
      this.renderTextInput()
    }
  }

  // --- Basket mode ---

  private renderBasket(c: Challenge) {
    // Hint / description
    if (c.hint) {
      const hint = h('p', 'hint basket-hint')
      hint.textContent = c.hint
      this.root.appendChild(hint)
    }

    // Fruit grid
    const grid = h('div', 'fruit-grid')
    const pool = c.pool ?? []
    for (const fruitName of pool) {
      const cell = h('div', 'grid-cell')
      if (this.answered && fruitName === c.fruit) {
        cell.classList.add(this.wasCorrect === false ? 'reveal-correct' : '')
      }
      const svgWrap = h('div', 'grid-svg')
      svgWrap.innerHTML = getFruitSvg(fruitName)
      cell.appendChild(svgWrap)

      const label = h('span', 'grid-label')
      label.textContent = fruitName
      cell.appendChild(label)

      if (!this.answered) {
        cell.classList.add('clickable')
        cell.onclick = () => this.checkAnswer(fruitName)
      } else if (fruitName === c.fruit) {
        cell.classList.add(this.wasCorrect ? 'anim-correct' : 'anim-correct')
      }
      grid.appendChild(cell)
    }
    this.root.appendChild(grid)

    // Feedback
    if (this.answered) {
      this.renderFeedback(c)
    }
  }

  // --- Shared UI ---

  private renderFeedback(c: Challenge) {
    const fb = h('div', `feedback ${this.wasCorrect === true ? 'correct' : this.wasCorrect === false ? 'incorrect' : 'reveal'}`)
    fb.textContent = this.wasCorrect === true
      ? 'Correct!'
      : this.wasCorrect === false
        ? `Not quite! It was: ${c.fruit}`
        : `Answer: ${c.fruit}`
    this.root.appendChild(fb)

    const btn = h('button', 'next-btn')
    btn.textContent = this.idx < this.challenges.length - 1 ? 'Next' : 'Finish'
    btn.onclick = () => this.advance()
    this.root.appendChild(btn)
  }

  private renderTextInput() {
    const form = h('div', 'input-area')
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'answer-input'
    input.placeholder = 'Type the fruit name...'
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && input.value.trim()) this.checkAnswer(input.value)
    }
    const btn = h('button', 'submit-btn')
    btn.textContent = 'Check'
    btn.onclick = () => { if (input.value.trim()) this.checkAnswer(input.value) }
    form.appendChild(input)
    form.appendChild(btn)
    this.root.appendChild(form)
    requestAnimationFrame(() => input.focus())
  }
}

function h(tag: string, className?: string): HTMLElement {
  const el = document.createElement(tag)
  if (className) el.className = className
  return el
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
