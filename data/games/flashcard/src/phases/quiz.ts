import type { GameCtx } from '../types'
import { el } from '../utils'
import { POINTS_CORRECT, AUTO_REVEAL_WRONG } from '../constants'
import { sfxCorrect, sfxWrong, sfxCoin } from '../audio'
import { renderHUD, renderDots, updateHUD, burstParticles, floatScore, shakeEl } from '../ui'

export function renderQuiz(ctx: GameCtx): void {
  const { root, s } = ctx
  root.innerHTML = ''

  const card = s.cards[s.cardIndex]
  if (!card) return

  renderHUD(root, s.score, `Card ${s.cardIndex + 1} / ${s.cards.length}`, s.streak)

  // --- Card ---
  const cardEl = el('div', 'card quiz-card')

  if (s.mode === 'SentenceCompletion') {
    const p = el('p', 'sentence')
    p.innerHTML = s.answered
      ? (card.sentence_template ?? '').replace(/_{2,}|\*{2,}/, `<span class="filled">${card.missing_word}</span>`)
      : (card.sentence_template ?? '').replace(/_{2,}|\*{2,}/, '<span class="blank">____</span>')
    cardEl.appendChild(p)
  } else {
    if (card.image_data) {
      const img = document.createElement('img')
      img.className = 'quiz-image'
      img.src = card.image_data.startsWith('data:') ? card.image_data : `data:image/jpeg;base64,${card.image_data}`
      img.alt = `Card ${s.cardIndex + 1}`
      cardEl.appendChild(img)
    }
  }

  root.appendChild(cardEl)

  // --- Answered state ---
  if (s.answered) {
    const correctText = card.answer ?? card.missing_word ?? ''
    const fb = el('div', s.wasCorrect === true ? 'feedback correct'
      : s.wasCorrect === false ? 'feedback incorrect'
      : 'feedback reveal')
    fb.textContent = s.wasCorrect === true ? 'Correct! ✓'
      : s.wasCorrect === false ? `Incorrect. Answer: ${correctText}`
      : `Answer: ${correctText}`
    root.appendChild(fb)

    const btn = el('button', 'next-btn') as HTMLButtonElement
    btn.textContent = s.cardIndex < s.cards.length - 1 ? 'Next →' : 'Finish'
    btn.onclick = () => { clearTimeout(s.advanceTimer); ctx.advance() }
    root.appendChild(btn)

    renderDots(root, s.cardIndex, s.cards.length)
    return
  }

  // --- Input area ---
  const submit = (value: string) => {
    const isCorrect = ctx.checkAnswer(value)
    if (isCorrect) {
      sfxCorrect()
      setTimeout(sfxCoin, 200)
      burstParticles(cardEl)
      floatScore(cardEl, `+${POINTS_CORRECT}`)
      updateHUD(root, s.score, s.streak)
    } else {
      sfxWrong()
      shakeEl(cardEl)
      if (s.wrongAttempts >= AUTO_REVEAL_WRONG) {
        s.answered = true
        s.wasCorrect = null
      }
    }
    ctx.render()
    ctx.sync()
  }

  if (s.mode === 'SentenceCompletion' && card.options?.length) {
    const opts = el('div', 'options')
    for (const opt of card.options) {
      const btn = el('button', 'option-btn') as HTMLButtonElement
      btn.textContent = opt
      btn.onclick = () => submit(opt)
      opts.appendChild(btn)
    }
    root.appendChild(opts)
  } else {
    const area = el('div', 'input-area')
    const input = document.createElement('input')
    input.className = 'answer-input'
    input.type = 'text'
    input.placeholder = s.mode === 'SentenceCompletion' ? 'Type the missing word…' : 'Type your answer…'
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(input.value) }

    const btn = el('button', 'submit-btn') as HTMLButtonElement
    btn.textContent = 'Check'
    btn.onclick = () => submit(input.value)

    area.appendChild(input)
    area.appendChild(btn)
    root.appendChild(area)
    requestAnimationFrame(() => input.focus())
  }

  renderDots(root, s.cardIndex, s.cards.length)
}
