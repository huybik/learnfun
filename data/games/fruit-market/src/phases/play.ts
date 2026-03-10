import type { GameCtx } from '../types'
import { el, gridCols } from '../utils'
import { renderHUD, renderDots, makeFruitCard, streakHtml, awardPoints, updateHUD } from '../ui'
import { sfxPop, sfxWrong, sfxWhoosh } from '../audio'

export function renderPlay(ctx: GameCtx) {
  const { root, s } = ctx
  const c = s.challenges[s.idx]
  if (!c) return
  root.innerHTML = ''

  renderHUD(root, s.coins, `Wave ${s.wave + 1}: ${s.idx + 1} / ${s.challenges.length}`, streakHtml(s.streak))

  const hint = el('div', 'challenge-hint')
  if (c.mode === 'shadow') hint.textContent = c.hint || 'Can you guess by the shape?'
  else if (c.mode === 'describe') hint.textContent = c.hint || 'Which fruit matches this description?'
  else hint.textContent = c.hint || `Find the ${c.fruit}!`
  root.appendChild(hint)

  if (s.timerEnabled && !s.answered && !s.isFollower) {
    const track = el('div', 'timer-bar-track')
    const fill = el('div', 'timer-bar-fill')
    fill.style.setProperty('--timer-ms', `${s.timerDuration}ms`)
    track.appendChild(fill)
    root.appendChild(track)
    s.timerStart = Date.now()
    s.advanceTimer = window.setTimeout(() => { if (!s.answered) doReveal(ctx) }, s.timerDuration)
  }

  const grid = el('div', 'fruit-grid')
  if (c.mode === 'shadow') grid.classList.add('shadow-mode')
  if (c.mode === 'describe') grid.classList.add('describe-mode')
  const pool = c.pool || [c.fruit]
  grid.style.gridTemplateColumns = `repeat(${gridCols(pool.length)}, 1fr)`

  pool.forEach((fruitName, i) => {
    const isAnswer = fruitName.toLowerCase() === c.fruit.toLowerCase()
    const extra = s.answered
      ? (isAnswer ? (s.playResult === 'revealed' ? 'is-revealed' : 'is-correct') : 'is-dimmed')
      : ''
    const card = makeFruitCard(fruitName, i, extra)
    if (!s.answered) {
      card.addEventListener('pointerenter', () => sfxPop())
      card.addEventListener('click', () => handlePick(ctx, fruitName, card))
    }
    grid.appendChild(card)
  })
  root.appendChild(grid)

  renderDots(root, s.idx, s.challenges.length)
}

export function handlePick(ctx: GameCtx, fruitName: string, card: HTMLElement) {
  const { root, s, bridge } = ctx
  if (s.isFollower) {
    bridge.relayAction('submit', { value: fruitName })
    return
  }
  if (s.answered) return
  const c = s.challenges[s.idx]
  if (!c) return

  const isCorrect = fruitName.toLowerCase() === c.fruit.toLowerCase()

  if (isCorrect) {
    s.answered = true
    s.playResult = 'correct'
    let bonus = 0
    if (s.timerEnabled) {
      const elapsed = Date.now() - s.timerStart
      bonus = Math.max(0, Math.ceil((1 - elapsed / s.timerDuration) * 5))
    }
    s.streak++
    card.classList.add('is-correct')
    awardPoints(ctx, 10 + bonus, card)
    clearTimeout(s.advanceTimer)

    const grid = root.querySelector('.fruit-grid')
    if (grid) { grid.classList.remove('shadow-mode', 'describe-mode') }

    root.querySelectorAll<HTMLElement>('.fruit-card').forEach(c => {
      if (c !== card) c.classList.add('is-dimmed')
    })

    bridge.emitEvent('correctAnswer', {
      challengeIndex: s.idx, expected: c.fruit, given: fruitName, score: s.score,
    })
    ctx.sync()
    if (!s.isFollower) {
      s.advanceTimer = window.setTimeout(() => ctx.advance(), 1800)
    }
  } else {
    s.wrongAttempts++
    card.classList.add('is-wrong')
    sfxWrong()
    setTimeout(() => card.classList.remove('is-wrong'), 500)
    s.streak = 0
    updateHUD(root, s.coins, s.streak)

    bridge.emitEvent('incorrectAnswer', {
      challengeIndex: s.idx, expected: c.fruit, given: fruitName, score: s.score,
    })

    if (s.wrongAttempts >= 3) doReveal(ctx)
  }
}

export function doReveal(ctx: GameCtx) {
  const { root, s } = ctx
  if (s.answered) return
  s.answered = true
  s.playResult = 'revealed'
  const c = s.challenges[s.idx]
  if (!c) return
  sfxWhoosh()
  clearTimeout(s.advanceTimer)

  const grid = root.querySelector('.fruit-grid')
  if (grid) { grid.classList.remove('shadow-mode', 'describe-mode') }

  const pool = c.pool || []
  const cards = root.querySelectorAll<HTMLElement>('.fruit-card')
  pool.forEach((name, i) => {
    if (name.toLowerCase() === c.fruit.toLowerCase()) cards[i]?.classList.add('is-revealed')
    else cards[i]?.classList.add('is-dimmed')
  })

  ctx.sync()
  if (!s.isFollower) {
    s.advanceTimer = window.setTimeout(() => ctx.advance(), 2200)
  }
}
