import type { GameCtx } from '../types'
import { el } from '../utils'
import { sfxPop } from '../audio'
import { renderHUD, renderDots } from '../ui'

export function renderLearn(ctx: GameCtx): void {
  const { root, s } = ctx
  root.innerHTML = ''

  renderHUD(root, s.score, 'Preview', s.streak)

  const card = s.cards[s.cardIndex]
  const cardEl = el('div', 'card learn-card')
  cardEl.style.animationDelay = '0ms'

  if (s.mode === 'SentenceCompletion' && card.sentence_template && card.missing_word) {
    const sentence = el('div', 'learn-sentence')
    sentence.innerHTML = card.sentence_template.replace(
      /_{2,}|\*{2,}/,
      `<span class="filled">${card.missing_word}</span>`
    )
    cardEl.appendChild(sentence)

    const answer = el('div', 'learn-answer')
    answer.textContent = card.missing_word
    cardEl.appendChild(answer)
  } else {
    if (card.image_data) {
      const img = document.createElement('img')
      img.className = 'learn-image'
      img.src = card.image_data.startsWith('data:')
        ? card.image_data
        : `data:image/png;base64,${card.image_data}`
      cardEl.appendChild(img)
    }

    const answer = el('div', 'learn-answer')
    answer.textContent = card.answer ?? ''
    cardEl.appendChild(answer)
  }

  root.appendChild(cardEl)

  const hint = el('div', 'learn-hint')
  hint.textContent = 'Tap to continue →'
  root.appendChild(hint)

  cardEl.addEventListener('click', () => {
    sfxPop()
    ctx.advance()
  })

  renderDots(root, s.cardIndex, s.cards.length)
}
