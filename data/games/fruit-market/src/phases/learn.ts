import type { GameCtx } from '../types'
import { TOTAL_WAVES } from '../constants'
import { getFruitSvg } from '../fruits'
import { el } from '../utils'
import { renderDots } from '../ui'

export function renderLearn(ctx: GameCtx) {
  const { root, s } = ctx
  const item = s.intro[s.introIdx]
  if (!item) return
  root.innerHTML = ''

  const phaseLabel = el('div', 'phase-label')
  phaseLabel.textContent = `Wave ${s.wave + 1} of ${TOTAL_WAVES} — Let's learn!`
  root.appendChild(phaseLabel)

  const card = el('div', 'intro-card')
  card.innerHTML = `
    <div class="intro-svg">${getFruitSvg(item.fruit)}</div>
    <h2 class="intro-title">${item.title || item.fruit}</h2>
    ${item.fact ? `<p class="intro-fact">${item.fact}</p>` : ''}
  `
  card.style.cursor = 'pointer'
  card.addEventListener('click', () => ctx.advance())
  root.appendChild(card)

  renderDots(root, s.introIdx, s.intro.length)
}
