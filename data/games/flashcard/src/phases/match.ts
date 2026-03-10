import type { GameCtx, MatchCard } from '../types'
import { el, shuffle } from '../utils'
import { POINTS_CORRECT, MAX_MATCH_PAIRS, MASTERY_MAX } from '../constants'
import { sfxFlip, sfxCorrect, sfxWrong, sfxCoin } from '../audio'
import { renderHUD, updateHUD, burstParticles, floatScore } from '../ui'

function truncate(text: string, max = 40): string {
  if (text.length <= max) return text
  // Keep ____ visible when truncating
  const blankIdx = text.indexOf('____')
  if (blankIdx >= 0 && blankIdx < max) return text.slice(0, max) + '...'
  return text.slice(0, max) + '...'
}

export function generateMatchCards(ctx: GameCtx): void {
  const { s } = ctx
  const pairs = s.cards.slice(0, MAX_MATCH_PAIRS)
  const all: MatchCard[] = []

  for (const card of pairs) {
    const pid = String(card.id)
    let termText: string
    let defText: string
    let image: string | undefined

    if (s.mode === 'SentenceCompletion') {
      termText = truncate(card.sentence_template ?? '')
      defText = card.missing_word ?? ''
    } else {
      termText = ''
      image = card.image_data
      defText = card.answer ?? ''
    }

    all.push({ id: `term-${card.id}`, type: 'term', pairId: pid, text: termText, image })
    all.push({ id: `def-${card.id}`, type: 'definition', pairId: pid, text: defText })
  }

  s.matchCards = shuffle(all)
  s.matchFlipped = []
  s.matchMatched = []
  s.matchLocked = false
}

function cardEl(mc: MatchCard): HTMLElement {
  const back = el('div', 'match-back')
  if (mc.type === 'term' && mc.image) {
    const img = document.createElement('img')
    img.src = mc.image.startsWith('data:') ? mc.image : `data:image/jpeg;base64,${mc.image}`
    img.alt = 'term'
    back.appendChild(img)
  } else {
    back.textContent = mc.text
  }
  return back
}

export function renderMatch(ctx: GameCtx): void {
  const { root, s } = ctx
  root.innerHTML = ''

  const matched = s.matchMatched.length / 2
  const total = s.matchCards.length / 2
  renderHUD(root, s.score, `Match ${matched} / ${total}`, s.streak)

  const grid = el('div', 'match-grid')
  const count = s.matchCards.length
  const cols = count <= 4 ? 2 : count <= 6 ? 3 : 4
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

  for (const mc of s.matchCards) {
    const card = el('div', 'match-card')
    card.setAttribute('data-id', mc.id)

    const isFlipped = s.matchFlipped.includes(mc.id) || s.matchMatched.includes(mc.id)
    const isMatched = s.matchMatched.includes(mc.id)

    const inner = el('div', 'match-inner')
    if (isFlipped) inner.classList.add('flipped')
    if (isMatched) card.classList.add('matched')

    const front = el('div', 'match-front')
    front.textContent = '?'
    const back = cardEl(mc)

    inner.appendChild(front)
    inner.appendChild(back)
    card.appendChild(inner)

    card.onclick = () => handleMatchFlip(ctx, mc.id)
    grid.appendChild(card)
  }

  root.appendChild(grid)
}

export function handleMatchFlip(ctx: GameCtx, id: string): void {
  const { s } = ctx
  if (s.isFollower) {
    ctx.bridge.emitEvent('_relay', { name: 'match_flip', params: { id } })
    return
  }
  if (s.matchLocked) return
  if (s.matchFlipped.includes(id) || s.matchMatched.includes(id)) return

  sfxFlip()
  s.matchFlipped.push(id)

  // Incremental DOM update — flip this card
  const cardDom = ctx.root.querySelector(`[data-id="${id}"]`)
  const inner = cardDom?.querySelector('.match-inner')
  inner?.classList.add('flipped')

  if (s.matchFlipped.length < 2) return

  // Two cards flipped — evaluate
  s.matchLocked = true
  const [firstId, secondId] = s.matchFlipped
  const card1 = s.matchCards.find(c => c.id === firstId)!
  const card2 = s.matchCards.find(c => c.id === secondId)!

  if (card1.pairId === card2.pairId) {
    // Match found
    setTimeout(() => {
      s.matchMatched.push(firstId, secondId)
      sfxCorrect()
      setTimeout(sfxCoin, 200)
      s.score += POINTS_CORRECT
      s.streak++
      if (s.streak > s.bestStreak) s.bestStreak = s.streak
      s.totalCorrect++
      s.totalAnswered++
      s.mastery[card1.pairId] = Math.min((s.mastery[card1.pairId] ?? 0) + 1, MASTERY_MAX)

      // Incremental DOM updates
      const el1 = ctx.root.querySelector(`[data-id="${firstId}"]`)
      const el2 = ctx.root.querySelector(`[data-id="${secondId}"]`)
      el1?.classList.add('matched')
      el2?.classList.add('matched')
      if (el1) burstParticles(el1 as HTMLElement)
      if (el2) floatScore(el2 as HTMLElement, `+${POINTS_CORRECT}`)

      // Update HUD center text
      const centerEl = ctx.root.querySelector('.hud-center')
      if (centerEl) centerEl.textContent = `Match ${s.matchMatched.length / 2} / ${s.matchCards.length / 2}`
      updateHUD(ctx.root, s.score, s.streak)

      s.matchFlipped = []
      s.matchLocked = false
      ctx.bridge.emitEvent('matchFound', { pairId: card1.pairId, score: s.score })
      ctx.sync()

      // All matched?
      if (s.matchMatched.length === s.matchCards.length) {
        setTimeout(() => ctx.advance(), 1500)
      }
    }, 400)
  } else {
    // No match
    sfxWrong()
    s.streak = 0
    s.totalAnswered++

    setTimeout(() => {
      const el1 = ctx.root.querySelector(`[data-id="${firstId}"] .match-inner`)
      const el2 = ctx.root.querySelector(`[data-id="${secondId}"] .match-inner`)
      el1?.classList.remove('flipped')
      el2?.classList.remove('flipped')

      s.matchFlipped = []
      s.matchLocked = false
      ctx.bridge.emitEvent('matchMiss', {})
      ctx.sync()
    }, 1000)
  }
}
