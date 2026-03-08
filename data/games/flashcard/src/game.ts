import type { GameAPI } from '@learnfun/game-sdk'
import { GameBridge } from '@learnfun/game-sdk'

interface Card {
  id: number | string
  image_data?: string
  answer?: string
  sentence_template?: string
  missing_word?: string
  options?: string[]
}

type Mode = 'ImageToWord' | 'SentenceCompletion'

export class FlashcardGame implements GameAPI {
  private bridge: GameBridge
  private root: HTMLElement
  private mode: Mode = 'SentenceCompletion'
  private cards: Card[] = []
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
    this.mode = (d.sub_type as Mode) || 'SentenceCompletion'
    this.cards = (d.cards as Card[]) || []
    this.idx = 0
    this.score = 0
    this.answered = false
    this.wasCorrect = null
    this.render()
    this.sync()
    this.bridge.emitEvent('gameStarted', { mode: this.mode, total: this.cards.length })
  }

  handleAction(name: string, params: Record<string, unknown>) {
    const actions: Record<string, () => void> = {
      submitAnswer: () => this.checkAnswer(String(params.answer ?? '')),
      nextCard: () => this.advance(),
      setScore: () => { this.score = Number(params.score); this.render() },
      setCardIndex: () => {
        this.idx = clamp(Number(params.index), 0, this.cards.length - 1)
        this.answered = false
        this.wasCorrect = null
        this.render()
      },
      skipToEnd: () => this.finish(),
      revealAnswer: () => { this.answered = true; this.wasCorrect = null; this.render() },
    }
    actions[name]?.()
    this.sync()
  }

  getState() {
    const card = this.cards[this.idx]
    return {
      mode: this.mode,
      cardIndex: this.idx,
      score: this.score,
      total: this.cards.length,
      answered: this.answered,
      isComplete: this.idx >= this.cards.length,
      currentAnswer: card ? (card.answer ?? card.missing_word ?? '') : '',
    }
  }

  destroy() {
    this.root.innerHTML = ''
  }

  // --- Internal ---

  private sync() {
    this.bridge.updateState(this.getState())
  }

  private correctAnswer(card: Card): string {
    return (card.answer ?? card.missing_word ?? '').trim().toLowerCase()
  }

  private checkAnswer(answer: string) {
    if (this.answered || !answer.trim()) return
    const card = this.cards[this.idx]
    if (!card) return

    const correct = this.correctAnswer(card)
    this.wasCorrect = answer.trim().toLowerCase() === correct
    this.answered = true
    if (this.wasCorrect) this.score += 10

    this.bridge.emitEvent(this.wasCorrect ? 'correctAnswer' : 'incorrectAnswer', {
      cardIndex: this.idx,
      expected: correct,
      given: answer.trim(),
      score: this.score,
    })
    this.render()
    this.sync()
  }

  private advance() {
    if (this.idx < this.cards.length - 1) {
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
    this.bridge.emitEvent('gameCompleted', { score: this.score, total: this.cards.length })
    this.bridge.endGame({ outcome: 'completed', finalScore: this.score })
    this.root.innerHTML = ''
    const div = h('div', 'completion')
    div.innerHTML = `<h2>Game Complete!</h2><p class="final-score">Score: ${this.score} / ${this.cards.length * 10}</p>`
    this.root.appendChild(div)
  }

  private render() {
    const card = this.cards[this.idx]
    if (!card) return
    this.root.innerHTML = ''

    // Header
    const header = h('div', 'header')
    header.innerHTML = `
      <span class="progress">Card ${this.idx + 1} / ${this.cards.length}</span>
      <span class="score">Score: ${this.score}</span>
    `
    this.root.appendChild(header)

    // Card content
    const cardEl = h('div', 'card')
    if (this.mode === 'ImageToWord' && card.image_data) {
      const img = document.createElement('img')
      img.src = card.image_data.startsWith('data:') ? card.image_data : `data:image/jpeg;base64,${card.image_data}`
      img.alt = `Card ${this.idx + 1}`
      cardEl.appendChild(img)
    } else if (this.mode === 'SentenceCompletion' && card.sentence_template) {
      const p = h('p', 'sentence')
      const answer = card.missing_word ?? ''
      if (this.answered) {
        p.innerHTML = card.sentence_template.split('____').join(`<span class="filled">${answer}</span>`)
      } else {
        p.innerHTML = card.sentence_template.split('____').join('<span class="blank">____</span>')
      }
      cardEl.appendChild(p)
    }
    this.root.appendChild(cardEl)

    // Feedback (after answering)
    if (this.answered) {
      const correctText = card.answer ?? card.missing_word ?? ''
      const fb = h('div', `feedback ${this.wasCorrect === true ? 'correct' : this.wasCorrect === false ? 'incorrect' : 'reveal'}`)
      fb.textContent = this.wasCorrect === true
        ? 'Correct!'
        : this.wasCorrect === false
          ? `Incorrect. Answer: ${correctText}`
          : `Answer: ${correctText}`
      this.root.appendChild(fb)

      const btn = h('button', 'next-btn')
      btn.textContent = this.idx < this.cards.length - 1 ? 'Next' : 'Finish'
      btn.onclick = () => this.advance()
      this.root.appendChild(btn)
      return
    }

    // Input area
    if (this.mode === 'SentenceCompletion' && card.options?.length) {
      const opts = h('div', 'options')
      for (const opt of card.options) {
        const btn = h('button', 'option-btn')
        btn.textContent = opt
        btn.onclick = () => this.checkAnswer(opt)
        opts.appendChild(btn)
      }
      this.root.appendChild(opts)
    } else {
      const form = h('div', 'input-area')
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'answer-input'
      input.placeholder = this.mode === 'ImageToWord' ? 'Type the word...' : 'Type the missing word...'
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
}

function h(tag: string, className?: string): HTMLElement {
  const el = document.createElement(tag)
  if (className) el.className = className
  return el
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
