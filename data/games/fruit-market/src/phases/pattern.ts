import type { GameCtx, PatternRound } from '../types'
import { getFruitSvg } from '../fruits'
import { el, shuffle } from '../utils'
import { renderHUD, renderDots, makeFruitCard, streakHtml, handleQuizPick, doQuizReveal } from '../ui'
import { sfxPop } from '../audio'

export function generatePatternRounds(fruits: string[]): PatternRound[] {
  if (fruits.length < 2) return []
  const picked = shuffle(fruits)
  const a = picked[0], b = picked[1]
  const distractors = shuffle(fruits.filter(f => f !== a && f !== b)).slice(0, 1)
  const options = shuffle([a, b, ...distractors])
  if (!options.includes(a)) options[0] = a
  return [{ sequence: [a, b, a, b], answer: a, options: shuffle(options) }]
}

export function renderPattern(ctx: GameCtx) {
  const { root, s } = ctx
  const round = s.patternRounds[s.patternIdx]
  if (!round) return
  root.innerHTML = ''

  renderHUD(root, s.coins, `Pattern! ${s.patternIdx + 1} / ${s.patternRounds.length}`, streakHtml(s.streak))

  const hint = el('div', 'challenge-hint')
  hint.textContent = 'What comes next?'
  root.appendChild(hint)

  const seqWrap = el('div', 'pattern-sequence')
  round.sequence.forEach(fruit => {
    const item = el('div', 'pattern-item')
    item.innerHTML = getFruitSvg(fruit)
    seqWrap.appendChild(item)
  })
  if (s.patternAnswered) {
    const ans = el('div', 'pattern-item pattern-answer')
    ans.innerHTML = getFruitSvg(round.answer)
    seqWrap.appendChild(ans)
  } else {
    const blank = el('div', 'pattern-item pattern-blank')
    blank.textContent = '?'
    seqWrap.appendChild(blank)
  }
  root.appendChild(seqWrap)

  const grid = el('div', 'fruit-grid')
  grid.style.gridTemplateColumns = `repeat(${round.options.length}, 1fr)`

  round.options.forEach((fruit, i) => {
    const isAnswer = fruit.toLowerCase() === round.answer.toLowerCase()
    const extra = s.patternAnswered ? (isAnswer ? 'is-correct' : 'is-dimmed') : ''
    const card = makeFruitCard(fruit, i, extra)
    if (!s.patternAnswered) {
      card.addEventListener('pointerenter', () => sfxPop())
      card.addEventListener('click', () => handlePatternPick(ctx, fruit))
    }
    grid.appendChild(card)
  })
  root.appendChild(grid)

  renderDots(root, s.patternIdx, s.patternRounds.length)
}

export function handlePatternPick(ctx: GameCtx, fruit: string) {
  const { s } = ctx
  if (s.patternAnswered) return
  const round = s.patternRounds[s.patternIdx]
  if (!round) return
  s.patternAnswered = true
  handleQuizPick(ctx, fruit, round.answer, round.options, renderPattern,
    ['patternCorrect', { round: s.patternIdx, answer: round.answer, score: s.score }],
    ['patternWrong', { round: s.patternIdx, picked: fruit, answer: round.answer }],
  )
}

export function doPatternReveal(ctx: GameCtx) {
  if (ctx.s.patternAnswered) return
  ctx.s.patternAnswered = true
  doQuizReveal(ctx, renderPattern)
}
