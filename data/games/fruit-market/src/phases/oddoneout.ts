import type { GameCtx } from '../types'
import { el } from '../utils'
import { renderHUD, renderDots, makeFruitCard, streakHtml, awardPoints } from '../ui'
import { sfxPop, sfxWrong, sfxWhoosh } from '../audio'

export function renderOddOneOut(ctx: GameCtx) {
  const { root, s } = ctx
  const round = s.oddRounds[s.oddIdx]
  if (!round) return
  root.innerHTML = ''

  renderHUD(root, s.coins, `Odd one out! ${s.oddIdx + 1} / ${s.oddRounds.length}`, streakHtml(s.streak))

  const hint = el('div', 'challenge-hint')
  hint.textContent = `Which one is NOT a ${round.trait}?`
  root.appendChild(hint)

  const grid = el('div', 'fruit-grid')
  grid.style.gridTemplateColumns = `repeat(${round.fruits.length <= 4 ? 2 : 3}, 1fr)`

  round.fruits.forEach((fruit, i) => {
    const isOdd = fruit.toLowerCase() === round.odd.toLowerCase()
    const extra = s.oddAnswered ? (isOdd ? 'is-correct' : 'is-dimmed') : ''
    const card = makeFruitCard(fruit, i, extra)
    if (!s.oddAnswered) {
      card.addEventListener('pointerenter', () => sfxPop())
      card.addEventListener('click', () => handleOddPick(ctx, fruit))
    }
    grid.appendChild(card)
  })
  root.appendChild(grid)

  if (s.oddAnswered && round.explanation) {
    const expl = el('div', 'odd-explanation')
    expl.textContent = round.explanation
    root.appendChild(expl)
  }

  renderDots(root, s.oddIdx, s.oddRounds.length)
}

export function handleOddPick(ctx: GameCtx, fruit: string) {
  const { root, s, bridge } = ctx
  if (s.oddAnswered) return
  const round = s.oddRounds[s.oddIdx]
  if (!round) return

  s.oddAnswered = true
  const isCorrect = fruit.toLowerCase() === round.odd.toLowerCase()

  if (isCorrect) {
    s.streak++
    const cards = root.querySelectorAll<HTMLElement>('.fruit-card')
    const idx = round.fruits.findIndex(f => f.toLowerCase() === fruit.toLowerCase())
    awardPoints(ctx, 10, idx >= 0 ? cards[idx] : undefined)
    bridge.emitEvent('oddCorrect', { round: s.oddIdx, odd: round.odd, score: s.score })
  } else {
    s.streak = 0; sfxWrong()
    bridge.emitEvent('oddWrong', { round: s.oddIdx, picked: fruit, odd: round.odd })
  }
  renderOddOneOut(ctx)
  ctx.sync()
  s.advanceTimer = window.setTimeout(() => ctx.advance(), 2000)
}

export function doOddReveal(ctx: GameCtx) {
  const { s } = ctx
  if (s.oddAnswered) return
  s.oddAnswered = true; sfxWhoosh()
  renderOddOneOut(ctx); ctx.sync()
  s.advanceTimer = window.setTimeout(() => ctx.advance(), 2200)
}
