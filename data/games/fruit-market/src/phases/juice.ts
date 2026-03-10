import type { GameCtx, DrinkRecipe } from '../types'
import { DRINK_RECIPES } from '../constants'
import { getFruitSvg, getDrinkSvg } from '../fruits'
import { sfxPop, sfxWrong } from '../audio'
import { el, gridCols, shuffle } from '../utils'
import { renderHUD, makeFruitCard, awardPoints } from '../ui'

export function getAvailableJuiceRecipes(learnedFruits: string[], waveFruits: string[]): DrinkRecipe[] {
  const known = [...learnedFruits, ...waveFruits]
  return DRINK_RECIPES.filter(r => r.fruits.every(f => known.includes(f)))
}

export function initJuiceRound(ctx: GameCtx) {
  const { s } = ctx
  const available = getAvailableJuiceRecipes(s.learnedFruits, s.waveFruits)
  s.juiceRecipe = available.length > 0 ? shuffle(available)[0] : null
  s.juiceBasket = []
}

export function renderJuice(ctx: GameCtx) {
  const { root, s } = ctx
  if (!s.juiceRecipe) { ctx.advanceToNextGame(); return }
  root.innerHTML = ''

  const allDone = s.juiceRecipe.fruits.every(f => s.juiceBasket.includes(f))

  renderHUD(root, s.coins, 'Make a drink!')

  const drinkCard = el('div', 'juice-card')
  const drinkSvg = getDrinkSvg(s.juiceRecipe.drink)
  let ingHtml = ''
  s.juiceRecipe.fruits.forEach(f => {
    const done = s.juiceBasket.includes(f)
    ingHtml += `<span class="recipe-ing ${done ? 'recipe-ing-done' : ''}"><span class="recipe-ing-svg">${getFruitSvg(f)}</span></span>`
  })
  drinkCard.innerHTML = `
    <div class="juice-drink">${drinkSvg}</div>
    <div class="juice-name">${s.juiceRecipe.name}</div>
    <div class="recipe-ingredients">${ingHtml}</div>
  `
  root.appendChild(drinkCard)

  const hint = el('div', 'challenge-hint')
  hint.textContent = allDone ? 'Delicious! \u{1F389}' : 'Pick the right fruits to make the drink!'
  root.appendChild(hint)

  if (!allDone) {
    const pool = [...s.juiceRecipe.fruits]
    const distractors = shuffle(s.learnedFruits.filter(f => !pool.includes(f))).slice(0, 3)
    pool.push(...distractors)
    const shuffledPool = shuffle(pool)

    const grid = el('div', 'fruit-grid')
    grid.style.gridTemplateColumns = `repeat(${gridCols(shuffledPool.length)}, 1fr)`

    shuffledPool.forEach((fruit, i) => {
      const picked = s.juiceBasket.includes(fruit)
      const card = makeFruitCard(fruit, i, picked ? 'is-bought' : '')
      if (!picked) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => handleJuicePick(ctx, fruit))
      }
      grid.appendChild(card)
    })
    root.appendChild(grid)
  }

  if (allDone && !s.isFollower) {
    s.advanceTimer = window.setTimeout(() => ctx.advance(), 2000)
  }
}

export function handleJuicePick(ctx: GameCtx, fruit: string) {
  const { root, s, bridge } = ctx
  if (s.isFollower) {
    bridge.relayAction('submit', { value: fruit })
    return
  }
  if (!s.juiceRecipe || s.juiceBasket.includes(fruit)) return
  const isCorrect = s.juiceRecipe.fruits.includes(fruit)

  const cards = root.querySelectorAll<HTMLElement>('.fruit-card')
  const pool = [...root.querySelectorAll('.fruit-label')].map(l => l.textContent?.toLowerCase())
  const idx = pool.indexOf(fruit.toLowerCase())
  const cardEl = idx >= 0 ? cards[idx] : undefined

  if (isCorrect) {
    s.juiceBasket.push(fruit)
    awardPoints(ctx, 10, cardEl)
    bridge.emitEvent('juiceCorrect', { fruit, recipe: s.juiceRecipe.name, score: s.score })
    if (cardEl) { cardEl.classList.add('is-bought'); cardEl.style.pointerEvents = 'none' }
    // Update recipe ingredient indicator
    const ings = root.querySelectorAll<HTMLElement>('.recipe-ing')
    s.juiceRecipe.fruits.forEach((f, i) => {
      if (f === fruit && ings[i]) ings[i].classList.add('recipe-ing-done')
    })
    // Update HUD score
    const hudScore = root.querySelector('.hud-score-val')
    if (hudScore) hudScore.textContent = String(s.coins)

    const allDone = s.juiceRecipe.fruits.every(f => s.juiceBasket.includes(f))
    if (allDone) {
      const hint = root.querySelector('.challenge-hint')
      if (hint) hint.textContent = 'Delicious! \u{1F389}'
      if (!s.isFollower) {
        s.advanceTimer = window.setTimeout(() => ctx.advance(), 2000)
      }
    }
  } else {
    sfxWrong()
    bridge.emitEvent('juiceWrong', { fruit, recipe: s.juiceRecipe.name })
    if (cardEl) {
      cardEl.classList.add('is-wrong')
      setTimeout(() => cardEl.classList.remove('is-wrong'), 500)
    }
  }
  ctx.sync()
}
