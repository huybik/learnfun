import type { GameCtx } from '../types'
import { el } from '../utils'
import { POINTS_CORRECT, SPEED_BONUS_MAX } from '../constants'
import { sfxCorrect, sfxWrong, sfxCoin } from '../audio'
import { renderHUD, renderDots, updateHUD, burstParticles, floatScore, shakeEl } from '../ui'

export function renderSpeed(ctx: GameCtx): void {
  const { root, s } = ctx
  root.innerHTML = ''

  const card = s.cards[s.cardIndex]
  if (!card) return

  renderHUD(root, s.score, `\u26A1 Speed ${s.cardIndex + 1} / ${s.cards.length}`, s.streak)

  // Speed badge
  const badge = el('div', 'speed-badge')
  badge.textContent = '\u26A1 SPEED ROUND'
  root.appendChild(badge)

  // Timer bar (only when unanswered)
  if (!s.answered) {
    const bar = el('div', 'timer-bar')
    const fill = el('div', 'timer-fill')
    fill.style.setProperty('--timer-ms', s.timerDuration + 'ms')
    const elapsed = Date.now() - s.timerStart
    if (elapsed > s.timerDuration * 0.75) fill.classList.add('warning')
    bar.appendChild(fill)
    root.appendChild(bar)
  }

  // Start timeout if not already running and not answered
  if (!s.isFollower && !s.answered && !s.speedTimerId) {
    if (!s.timerStart) s.timerStart = Date.now()
    const remaining = Math.max(0, s.timerDuration - (Date.now() - s.timerStart))
    s.speedTimerId = window.setTimeout(() => {
      s.answered = true
      s.wasCorrect = false
      s.totalAnswered++
      s.streak = 0
      s.mastery[String(card.id)] = 0
      sfxWrong()
      ctx.bridge.emitEvent('incorrectAnswer', {
        cardIndex: s.cardIndex,
        expected: card.answer ?? card.missing_word ?? '',
        given: '',
        score: s.score,
      })
      ctx.render()
      ctx.sync()
      s.advanceTimer = window.setTimeout(() => ctx.advance(), 1500)
    }, remaining)
  }

  // Card
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

  // Answered state
  if (s.answered) {
    clearTimeout(s.speedTimerId)
    s.speedTimerId = 0

    const correctText = card.answer ?? card.missing_word ?? ''
    const fb = el('div', s.wasCorrect === true ? 'feedback correct'
      : s.wasCorrect === false ? 'feedback incorrect'
      : 'feedback reveal')
    fb.textContent = s.wasCorrect === true ? 'Correct! \u2713'
      : s.wasCorrect === false ? `Incorrect. Answer: ${correctText}`
      : `Answer: ${correctText}`
    root.appendChild(fb)

    if (!s.isFollower && !s.advanceTimer) {
      s.advanceTimer = window.setTimeout(() => ctx.advance(), 1500)
    }

    renderDots(root, s.cardIndex, s.cards.length)
    return
  }

  // Input area
  const submit = (value: string) => {
    if (s.isFollower) {
      ctx.checkAnswer(value)
      return
    }
    clearTimeout(s.speedTimerId)
    s.speedTimerId = 0

    const isCorrect = ctx.checkAnswer(value)

    let bonus = 0
    if (isCorrect) {
      const elapsed = Date.now() - s.timerStart
      const ratio = Math.max(0, 1 - elapsed / s.timerDuration)
      bonus = Math.round(ratio * SPEED_BONUS_MAX)
      if (bonus > 0) s.score += bonus

      sfxCorrect()
      setTimeout(sfxCoin, 200)
      burstParticles(cardEl)
      floatScore(cardEl, bonus > 0 ? `+${POINTS_CORRECT + bonus}` : `+${POINTS_CORRECT}`)
      updateHUD(root, s.score, s.streak)
    } else {
      sfxWrong()
      shakeEl(cardEl)
    }

    ctx.render()
    ctx.sync()
  }

  if (card.options?.length) {
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
    input.placeholder = s.mode === 'SentenceCompletion' ? 'Type the missing word\u2026' : 'Type your answer\u2026'
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
