import type { GameCtx, ShopItem } from '../types'
import { WAVE_SIZE } from '../constants'
import { FRUIT_NAMES, getFruitSvg } from '../fruits'
import basketSvg from '../assets/basket.svg?raw'
import { sfxPop, sfxCoin } from '../audio'
import { el, gridCols } from '../utils'
import { renderHUD, makeFruitCard } from '../ui'

export function renderShop(ctx: GameCtx) {
  const { root, s } = ctx
  root.innerHTML = ''
  const unlearned = FRUIT_NAMES.filter(f => !s.learnedFruits.includes(f) && !s.shopBasket.includes(f))
  const remaining = WAVE_SIZE - s.shopBasket.length

  renderHUD(root, s.coins,
    `Pick ${remaining} fruit${remaining !== 1 ? 's' : ''} to learn!`,
    `\u{1F9FA} ${s.shopBasket.length}/${WAVE_SIZE}`,
  )

  const hint = el('div', 'challenge-hint')
  hint.textContent = s.shopBasket.length >= WAVE_SIZE
    ? 'Great choices! Let\'s learn about them! \u{1F389}'
    : `Each fruit costs \u{1FA99}${s.fruitPrice} \u2014 choose wisely!`
  root.appendChild(hint)

  const grid = el('div', 'fruit-grid')
  grid.style.gridTemplateColumns = `repeat(${gridCols(unlearned.length)}, 1fr)`

  unlearned.forEach((fruit, i) => {
    const canAfford = s.coins >= s.fruitPrice && s.shopBasket.length < WAVE_SIZE
    const card = makeFruitCard(fruit, i, 'shop-item' + (!canAfford ? ' is-expensive' : ''))
    const price = el('span', 'shop-price')
    price.textContent = `\u{1FA99} ${s.fruitPrice}`
    card.querySelector('.fruit-inner')!.appendChild(price)
    if (canAfford) {
      card.addEventListener('pointerenter', () => sfxPop())
      card.addEventListener('click', () => handleBuy(ctx, { fruit, price: s.fruitPrice }))
    }
    grid.appendChild(card)
  })
  root.appendChild(grid)

  if (s.shopBasket.length > 0) {
    const dropZone = el('div', 'basket-drop-zone')
    const basketIcon = el('div', 'basket-icon')
    basketIcon.innerHTML = basketSvg
    dropZone.appendChild(basketIcon)
    const basketItems = el('div', 'basket-items')
    s.shopBasket.forEach(fruit => {
      const mini = el('span', 'shop-basket-svg')
      mini.innerHTML = getFruitSvg(fruit)
      basketItems.appendChild(mini)
    })
    dropZone.appendChild(basketItems)
    root.appendChild(dropZone)
  }

  if (s.shopBasket.length >= WAVE_SIZE) {
    s.advanceTimer = window.setTimeout(() => ctx.advance(), 2000)
  }
}

export function handleBuy(ctx: GameCtx, item: ShopItem) {
  const { s, bridge } = ctx
  if (s.shopBasket.includes(item.fruit) || s.coins < item.price || s.shopBasket.length >= WAVE_SIZE) return
  clearTimeout(s.advanceTimer)
  s.shopBasket.push(item.fruit)
  s.coins -= item.price
  sfxCoin()
  bridge.emitEvent('itemBought', { fruit: item.fruit, price: item.price, budget: s.coins, basket: [...s.shopBasket] })
  renderShop(ctx)
  ctx.sync()
}
