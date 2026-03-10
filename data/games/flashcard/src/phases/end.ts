import type { GameCtx } from '../types'
import { MASTERY_MAX } from '../constants'
import { el } from '../utils'
import { sfxComplete } from '../audio'

export function renderEnd(ctx: GameCtx): void {
  const { root, s } = ctx
  root.innerHTML = ''

  sfxComplete()

  const screen = el('div', 'end-screen')

  const trophy = el('div', 'end-trophy')
  trophy.textContent = '🏆'
  screen.appendChild(trophy)

  const title = el('div', 'end-title')
  title.textContent = 'Great Job!'
  screen.appendChild(title)

  const score = el('div', 'end-score')
  score.textContent = `Score: ${s.score}`
  screen.appendChild(score)

  // Stats grid
  const stats = el('div', 'end-stats')

  const accuracy = s.totalAnswered > 0 ? `${s.totalCorrect}/${s.totalAnswered}` : '—'
  const bestStreak = s.bestStreak >= 2 ? `🔥 ${s.bestStreak}` : `${s.bestStreak}`
  const mastered = Object.values(s.mastery).filter(v => v >= MASTERY_MAX).length

  const statItems = [
    ['Accuracy', accuracy],
    ['Best Streak', bestStreak],
    ['Cards Mastered', `${mastered}`],
    ['Total Cards', `${s.cards.length}`],
  ]

  for (const [label, value] of statItems) {
    const item = el('div', 'end-stat')
    const labelEl = el('div', 'end-stat-label')
    labelEl.textContent = label
    const valueEl = el('div', 'end-stat-value')
    valueEl.textContent = value
    item.appendChild(labelEl)
    item.appendChild(valueEl)
    stats.appendChild(item)
  }

  screen.appendChild(stats)

  // Mastery section
  if (s.cards.length > 0) {
    const masterySection = el('div', 'mastery-section')

    const masteryTitle = el('div', 'mastery-title')
    masteryTitle.textContent = 'Card Mastery'
    masterySection.appendChild(masteryTitle)

    const masteryCards = el('div', 'mastery-cards')

    for (const card of s.cards) {
      const cardId = String(card.id)
      const level = s.mastery[cardId] ?? 0
      const text = card.answer ?? card.missing_word ?? `Card ${card.id}`
      const truncated = text.length > 20 ? text.slice(0, 20) + '…' : text

      const mc = el('div', `mastery-card${level >= MASTERY_MAX ? ' mastered' : ''}`)

      const textEl = el('div', 'mastery-card-text')
      textEl.textContent = truncated
      mc.appendChild(textEl)

      const starsEl = el('div', 'mastery-stars')
      let stars = ''
      for (let i = 0; i < MASTERY_MAX; i++) {
        stars += i < level ? '⭐' : '☆'
      }
      starsEl.textContent = stars
      mc.appendChild(starsEl)

      masteryCards.appendChild(mc)
    }

    masterySection.appendChild(masteryCards)
    screen.appendChild(masterySection)
  }

  root.appendChild(screen)

  ctx.bridge.endGame({ outcome: 'completed', finalScore: s.score })
  ctx.bridge.emitEvent('gameCompleted', { score: s.score, total: s.cards.length })
}
