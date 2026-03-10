import type { GameCtx } from '../types'
import { sfxComplete } from '../audio'
import { el } from '../utils'

export function renderEnd(ctx: GameCtx) {
  const { root, s, bridge } = ctx
  clearTimeout(s.advanceTimer)
  sfxComplete()
  bridge.emitEvent('gameCompleted', { score: s.score, coins: s.coins, learnedFruits: [...s.learnedFruits] })
  bridge.endGame({ outcome: 'completed', finalScore: s.score })

  root.innerHTML = ''
  const screen = el('div', 'end-screen')
  let details = ''
  details += `<div class="end-detail">\u{1F34E} Learned ${s.learnedFruits.length} fruits</div>`
  if (s.streak >= 2) details += `<div class="end-detail">\u{1F525} Best streak: ${s.streak}</div>`

  screen.innerHTML = `
    <div class="end-trophy">\u{1F3C6}</div>
    <h2 class="end-title">Great Job!</h2>
    <div class="end-score">
      \u{1FA99} ${s.score} coins earned
    </div>
    ${details}
  `
  root.appendChild(screen)
}
