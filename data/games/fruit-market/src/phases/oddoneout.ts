import type { GameCtx, OddOneOutRound } from '../types'
import { FRUIT_COLORS, COLOR_NAMES } from '../constants'
import { el, shuffle } from '../utils'
import { renderHUD, renderDots, makeFruitCard, streakHtml, awardPoints } from '../ui'
import { sfxPop, sfxWrong, sfxWhoosh } from '../audio'

export function generateOddRounds(fruits: string[]): OddOneOutRound[] {
  if (fruits.length < 4) return []
  const groups: Record<string, string[]> = {}
  fruits.forEach(f => {
    const color = FRUIT_COLORS[f] || 'other'
    if (!groups[color]) groups[color] = []
    groups[color].push(f)
  })
  const bigGroups = Object.entries(groups).filter(([, fs]) => fs.length >= 3)
  if (bigGroups.length === 0) return []
  const [trait, group] = shuffle(bigGroups)[0]
  const three = shuffle(group).slice(0, 3)
  const others = fruits.filter(f => !group.includes(f))
  if (others.length === 0) return []
  const odd = shuffle(others)[0]
  const traitName = COLOR_NAMES[trait] || trait
  return [{
    fruits: shuffle([...three, odd]),
    odd,
    trait: `${traitName.toLowerCase()} fruit`,
    explanation: `${odd.charAt(0).toUpperCase() + odd.slice(1)} is not ${traitName.toLowerCase()} \u2014 the rest are!`,
  }]
}

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
