import type { GameCtx, MemoryRound } from '../types'
import { getFruitSvg } from '../fruits'
import { sfxPop, sfxWrong } from '../audio'
import { el, shuffle } from '../utils'
import { renderHUD, renderDots, awardPoints } from '../ui'

export function generateMemoryRounds(fruits: string[]): MemoryRound[] {
  const count = Math.min(4, fruits.length)
  return [{ fruits: shuffle(fruits).slice(0, count) }]
}

export function initMemoryRound(ctx: GameCtx) {
  const { s } = ctx
  const round = s.memoryRounds[s.memoryIdx]
  if (!round) return
  const cards: { fruit: string; id: number }[] = []
  round.fruits.forEach((fruit, i) => {
    cards.push({ fruit, id: i * 2 })
    cards.push({ fruit, id: i * 2 + 1 })
  })
  s.memoryCards = cards.sort(() => Math.random() - 0.5)
  s.memoryFlipped = []
  s.memoryMatched = new Set()
  s.memoryLocked = false
}

export function renderMemory(ctx: GameCtx) {
  const { root, s } = ctx
  root.innerHTML = ''
  const round = s.memoryRounds[s.memoryIdx]
  if (!round) return

  renderHUD(root, s.coins, `Memory! ${s.memoryMatched.size / 2} / ${s.memoryCards.length / 2}`)

  const hint = el('div', 'challenge-hint')
  hint.textContent = 'Find the matching pairs!'
  root.appendChild(hint)

  const grid = el('div', 'fruit-grid memory-grid')
  const total = s.memoryCards.length
  grid.style.gridTemplateColumns = `repeat(${total <= 8 ? 4 : total <= 12 ? 4 : 5}, 1fr)`

  s.memoryCards.forEach((card, i) => {
    const isFlipped = s.memoryFlipped.includes(card.id) || s.memoryMatched.has(card.id)
    const isMatched = s.memoryMatched.has(card.id)
    const cardEl = el('div', 'fruit-card memory-card' + (isFlipped ? ' is-flipped' : '') + (isMatched ? ' is-matched' : ''))
    cardEl.dataset.cardId = String(card.id)
    cardEl.style.animationDelay = `${i * 0.04}s`
    const inner = el('div', 'fruit-inner memory-inner')

    if (isFlipped) {
      fillMemoryFront(inner, card.fruit)
    } else {
      const back = el('div', 'memory-back')
      back.textContent = '?'
      inner.appendChild(back)
    }

    cardEl.appendChild(inner)
    if (!isFlipped && !s.memoryLocked) {
      cardEl.addEventListener('pointerenter', () => sfxPop())
      cardEl.addEventListener('click', () => handleMemoryFlip(ctx, card.id))
    }
    grid.appendChild(cardEl)
  })
  root.appendChild(grid)

  renderDots(root, s.memoryMatched.size / 2, s.memoryCards.length / 2)
}

export function handleMemoryFlip(ctx: GameCtx, cardId: number) {
  const { root, s, bridge } = ctx
  if (s.memoryLocked || s.memoryFlipped.includes(cardId) || s.memoryMatched.has(cardId)) return
  s.memoryFlipped.push(cardId)
  sfxPop()
  flipMemoryCardDom(ctx, cardId)

  if (s.memoryFlipped.length === 2) {
    s.memoryLocked = true
    const [id1, id2] = s.memoryFlipped
    const c1 = s.memoryCards.find(c => c.id === id1)!
    const c2 = s.memoryCards.find(c => c.id === id2)!

    if (c1.fruit === c2.fruit) {
      s.memoryMatched.add(id1)
      s.memoryMatched.add(id2)
      s.memoryFlipped = []
      s.memoryLocked = false
      awardPoints(ctx, 10)
      bridge.emitEvent('memoryMatch', { fruit: c1.fruit, matched: s.memoryMatched.size / 2, total: s.memoryCards.length / 2, score: s.score })
      matchMemoryCardDom(root, id1)
      matchMemoryCardDom(root, id2)
      updateMemoryHUD(root, s)

      if (s.memoryMatched.size === s.memoryCards.length) {
        bridge.emitEvent('memoryRoundComplete', { round: s.memoryIdx, score: s.score })
        s.advanceTimer = window.setTimeout(() => ctx.advance(), 1200)
      }
      ctx.sync()
    } else {
      sfxWrong()
      bridge.emitEvent('memoryMiss', { fruit1: c1.fruit, fruit2: c2.fruit })
      setTimeout(() => {
        unflipMemoryCardDom(ctx, id1)
        unflipMemoryCardDom(ctx, id2)
        s.memoryFlipped = []
        s.memoryLocked = false
      }, 1000)
    }
  }
}

function fillMemoryFront(inner: Element, fruit: string) {
  inner.innerHTML = ''
  const svgWrap = el('div', 'fruit-svg')
  svgWrap.innerHTML = getFruitSvg(fruit)
  inner.appendChild(svgWrap)
  const label = el('span', 'fruit-label')
  label.textContent = fruit
  inner.appendChild(label)
}

function getMemoryCardEl(root: HTMLElement, cardId: number): HTMLElement | null {
  return root.querySelector(`[data-card-id="${cardId}"]`)
}

function flipMemoryCardDom(ctx: GameCtx, cardId: number) {
  const cardEl = getMemoryCardEl(ctx.root, cardId)
  if (!cardEl) return
  cardEl.classList.add('is-flipped')
  const inner = cardEl.querySelector('.memory-inner')!
  const card = ctx.s.memoryCards.find(c => c.id === cardId)!
  fillMemoryFront(inner, card.fruit)
}

function unflipMemoryCardDom(ctx: GameCtx, cardId: number) {
  const cardEl = getMemoryCardEl(ctx.root, cardId)
  if (!cardEl) return
  cardEl.classList.remove('is-flipped')
  const inner = cardEl.querySelector('.memory-inner')!
  inner.innerHTML = ''
  const back = el('div', 'memory-back')
  back.textContent = '?'
  inner.appendChild(back)
  cardEl.addEventListener('pointerenter', () => sfxPop(), { once: true })
  cardEl.addEventListener('click', () => handleMemoryFlip(ctx, cardId), { once: true })
}

function matchMemoryCardDom(root: HTMLElement, cardId: number) {
  const cardEl = getMemoryCardEl(root, cardId)
  if (!cardEl) return
  cardEl.classList.add('is-matched')
}

function updateMemoryHUD(root: HTMLElement, s: GameCtx['s']) {
  const hudText = root.querySelector('.hud-center')
  if (hudText) hudText.textContent = `Memory! ${s.memoryMatched.size / 2} / ${s.memoryCards.length / 2}`
  const hudScore = root.querySelector('.hud-score-val')
  if (hudScore) hudScore.textContent = String(s.coins)
  const dots = root.querySelector('.progress-dots')
  if (dots) {
    dots.innerHTML = ''
    const total = s.memoryCards.length / 2
    for (let i = 0; i < total; i++) {
      dots.appendChild(el('div', i < s.memoryMatched.size / 2 ? 'dot done' : i === s.memoryMatched.size / 2 ? 'dot active' : 'dot'))
    }
  }
}
