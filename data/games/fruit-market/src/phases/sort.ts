import type { GameCtx, SortCategory, SortRound } from '../types'
import { FRUIT_COLORS, COLOR_NAMES, COLOR_EMOJIS, BIN_COLORS, coloredBasket } from '../constants'
import { getFruitSvg } from '../fruits'
import basketSvg from '../assets/basket.svg?raw'
import { sfxPop, sfxWrong, sfxWhoosh } from '../audio'
import { el, gridCols, shuffle } from '../utils'
import { renderHUD, renderDots, makeFruitCard, awardPoints } from '../ui'
import { startDrag } from '../drag'

export function generateSortRounds(fruits: string[]): SortRound[] {
  if (fruits.length < 6) return []
  const groups: Record<string, string[]> = {}
  fruits.forEach(f => {
    const color = FRUIT_COLORS[f] || 'other'
    if (!groups[color]) groups[color] = []
    groups[color].push(f)
  })
  const validGroups = Object.entries(groups).filter(([, fs]) => fs.length >= 2)
  if (validGroups.length < 2) return []
  const selected = shuffle(validGroups).slice(0, 3)
  const allFruits: string[] = []
  const categories: SortCategory[] = []
  selected.forEach(([color, fs]) => {
    const picked = shuffle(fs).slice(0, 2)
    allFruits.push(...picked)
    categories.push({
      name: `${COLOR_NAMES[color] || color} Fruits`,
      emoji: COLOR_EMOJIS[color] || '',
      fruits: picked,
    })
  })
  return [{ fruits: allFruits, categories }]
}

export function initSortRound(ctx: GameCtx) {
  const { s } = ctx
  const round = s.sortRounds[s.sortIdx]
  if (!round) return
  s.sortRemaining = [...round.fruits].sort(() => Math.random() - 0.5)
  s.sortSelected = null
}

export function renderSort(ctx: GameCtx) {
  const { root, s } = ctx
  const round = s.sortRounds[s.sortIdx]
  if (!round) return
  root.innerHTML = ''

  renderHUD(root, s.coins,
    `Sort! ${s.sortRemaining.length} left`,
    s.sortRounds.length > 1 ? `${s.sortIdx + 1}/${s.sortRounds.length}` : '',
  )

  const hint = el('div', 'challenge-hint')
  hint.textContent = s.sortSelected
    ? `Where does the ${s.sortSelected} go?`
    : 'Tap a fruit, then pick its bin \u2014 or drag!'
  root.appendChild(hint)

  // Category bins
  const binsWrap = el('div', 'sort-bins')
  round.categories.forEach((cat, catIdx) => {
    const sorted = cat.fruits.filter(f => !s.sortRemaining.includes(f))
    const binClr = BIN_COLORS[cat.emoji || '']
    const bin = el('div', 'sort-bin' + (s.sortSelected ? ' sort-bin-active' : ''))
    const basketEl = el('div', 'sort-bin-basket')
    basketEl.innerHTML = binClr ? coloredBasket(catIdx, binClr[0], binClr[1]) : basketSvg
    bin.appendChild(basketEl)
    if (sorted.length > 0) {
      const fruits = el('div', 'sort-bin-fruits')
      sorted.forEach(f => { const sp = el('span', 'sort-bin-fruit'); sp.innerHTML = getFruitSvg(f); fruits.appendChild(sp) })
      bin.appendChild(fruits)
    }
    const label = el('div', 'sort-bin-label')
    label.textContent = cat.name
    bin.appendChild(label)
    const count = el('div', 'sort-bin-count')
    count.textContent = `${sorted.length} / ${cat.fruits.length}`
    bin.appendChild(count)
    bin.addEventListener('click', () => {
      if (s.sortSelected) handleSort(ctx, s.sortSelected, cat)
    })
    binsWrap.appendChild(bin)
  })
  root.appendChild(binsWrap)

  if (s.sortRemaining.length > 0) {
    const grid = el('div', 'fruit-grid')
    grid.style.gridTemplateColumns = `repeat(${gridCols(s.sortRemaining.length)}, 1fr)`

    s.sortRemaining.forEach((fruitName, i) => {
      const extra = fruitName === s.sortSelected ? 'is-selected' : ''
      const card = makeFruitCard(fruitName, i, extra)
      card.addEventListener('pointerenter', () => sfxPop())
      card.addEventListener('click', () => {
        root.querySelectorAll('.fruit-card.is-selected').forEach(c => c.classList.remove('is-selected'))
        card.classList.add('is-selected')
        s.sortSelected = fruitName
        const h = root.querySelector('.challenge-hint')
        if (h) h.textContent = `Where does the ${fruitName} go?`
        root.querySelectorAll('.sort-bin').forEach(b => b.classList.add('sort-bin-active'))
      })

      // Drag to sort
      card.style.touchAction = 'none'
      card.addEventListener('pointerdown', (e) => {
        startDrag(root, e, fruitName, card, '.sort-bin', (target) => {
          const bins = [...root.querySelectorAll('.sort-bin')]
          const ci = bins.indexOf(target)
          if (ci >= 0) {
            s.sortSelected = fruitName
            handleSort(ctx, fruitName, round.categories[ci])
          }
        })
      })
      grid.appendChild(card)
    })
    root.appendChild(grid)
  }

  const done = round.fruits.length - s.sortRemaining.length
  renderDots(root, done, round.fruits.length)
}

export function handleSort(ctx: GameCtx, fruitName: string, category: SortCategory) {
  const { root, s, bridge } = ctx
  if (s.isFollower) {
    bridge.relayAction('sort', { fruit: fruitName, category: category.name })
    return
  }
  const isCorrect = category.fruits.some(f => f.toLowerCase() === fruitName.toLowerCase())
  if (isCorrect) {
    const cards = root.querySelectorAll<HTMLElement>('.fruit-card')
    const ci = s.sortRemaining.indexOf(fruitName)
    if (ci >= 0 && cards[ci]) cards[ci].classList.add('is-correct')
    s.sortRemaining = s.sortRemaining.filter(f => f !== fruitName)
    s.sortSelected = null
    awardPoints(ctx, 5, ci >= 0 ? cards[ci] : undefined)
    bridge.emitEvent('correctSort', { fruit: fruitName, category: category.name, score: s.score })
    if (s.sortRemaining.length === 0) {
      bridge.emitEvent('sortRoundComplete', { round: s.sortIdx, score: s.score })
      if (!s.isFollower) {
        s.advanceTimer = window.setTimeout(() => ctx.advance(), 1500)
      }
    }
    setTimeout(() => renderSort(ctx), 450)
  } else {
    sfxWrong()
    const bins = root.querySelectorAll('.sort-bin')
    const round = s.sortRounds[s.sortIdx]
    if (round) {
      const catIdx = round.categories.indexOf(category)
      if (catIdx >= 0 && bins[catIdx]) {
        bins[catIdx].classList.add('is-wrong')
        setTimeout(() => bins[catIdx].classList.remove('is-wrong'), 500)
      }
    }
    bridge.emitEvent('incorrectSort', { fruit: fruitName, category: category.name })
  }
  ctx.sync()
}

export function doSortReveal(ctx: GameCtx) {
  const { s } = ctx
  const round = s.sortRounds[s.sortIdx]
  if (!round || s.sortRemaining.length === 0) return
  const fruit = s.sortSelected || s.sortRemaining[0]
  const cat = round.categories.find(c => c.fruits.some(f => f.toLowerCase() === fruit.toLowerCase()))
  if (!cat) return

  sfxWhoosh()
  s.sortSelected = fruit
  renderSort(ctx)

  const bins = ctx.root.querySelectorAll('.sort-bin')
  const catIdx = round.categories.indexOf(cat)
  if (catIdx >= 0 && bins[catIdx]) bins[catIdx].classList.add('is-revealed')
  if (!s.isFollower) {
    s.advanceTimer = window.setTimeout(() => handleSort(ctx, fruit, cat), 1500)
  }
}
