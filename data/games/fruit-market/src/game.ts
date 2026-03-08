import type { GameAPI } from '@learnfun/game-sdk'
import { GameBridge } from '@learnfun/game-sdk'
import { getFruitSvg } from './fruits'
import basketSvg from './assets/basket.svg?raw'
import { sfxPop, sfxCorrect, sfxWrong, sfxCoin, sfxComplete, sfxWhoosh } from './audio'

// ===================== Types =====================

interface IntroItem { fruit: string; title?: string; fact?: string }
interface Challenge { id: number | string; fruit: string; hint?: string; pool: string[] }
interface SortCategory { name: string; emoji?: string; fruits: string[] }
interface SortRound { fruits: string[]; categories: SortCategory[] }
interface ShopItem { fruit: string; price: number }
interface ShopData { budget: number; items: ShopItem[]; goal?: string }

type Phase = 'learn' | 'play' | 'sort' | 'shop'
const WAVE_SIZE = 4

export class FruitMarketGame implements GameAPI {
  private bridge: GameBridge
  private root: HTMLElement
  private phase: Phase = 'play'
  private wave = 0 // learn 3 → play 3 → learn 3 → play 3 → ...

  // Learn
  private intro: IntroItem[] = []
  private introIdx = 0 // absolute index

  // Play
  private challenges: Challenge[] = []
  private idx = 0 // absolute index
  private score = 0
  private streak = 0
  private answered = false
  private wrongAttempts = 0
  private advanceTimer = 0

  // Sort
  private sortRounds: SortRound[] = []
  private sortIdx = 0
  private sortRemaining: string[] = []
  private sortSelected: string | null = null

  // Shop
  private shopData: ShopData | null = null
  private shopBudget = 0
  private shopBasket: string[] = []

  // Drag state
  private dragEl: HTMLElement | null = null
  private dragFruit: string | null = null
  private dragOffsetX = 0
  private dragOffsetY = 0

  constructor(root: HTMLElement, bridge: GameBridge) {
    this.root = root
    this.bridge = bridge
  }

  init(data: unknown) {
    const d = data as Record<string, unknown>
    this.challenges = (d.challenges as Challenge[]) || []
    this.intro = (d.intro as IntroItem[]) || []
    this.sortRounds = (d.sort as SortRound[]) || []
    this.shopData = (d.shop as ShopData) || null

    this.wave = 0
    this.introIdx = 0
    this.idx = 0
    this.score = 0
    this.streak = 0
    this.answered = false
    this.wrongAttempts = 0
    this.sortIdx = 0
    this.sortRemaining = []
    this.sortSelected = null
    this.shopBudget = this.shopData?.budget ?? 0
    this.shopBasket = []
    clearTimeout(this.advanceTimer)

    this.phase = this.intro.length > 0 ? 'learn' : 'play'
    this.render()
    this.sync()
    this.bridge.emitEvent('gameStarted', { total: this.challenges.length, phase: this.phase })
  }

  handleAction(name: string, params: Record<string, unknown>) {
    const actions: Record<string, () => void> = {
      submit: () => {
        const val = String(params.value ?? '')
        if (this.phase === 'play') {
          const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
          const c = this.challenges[this.idx]
          if (!c) return
          const i = (c.pool || []).findIndex(f => f.toLowerCase() === val.toLowerCase())
          if (i >= 0 && cards[i]) this.handlePick(val, cards[i])
        }
        if (this.phase === 'sort') {
          const round = this.sortRounds[this.sortIdx]
          if (!round) return
          const cat = round.categories.find(c => c.fruits.some(f => f.toLowerCase() === val.toLowerCase()))
          const actual = this.sortRemaining.find(f => f.toLowerCase() === val.toLowerCase())
          if (cat && actual) { this.sortSelected = actual; this.handleSort(actual, cat) }
        }
        if (this.phase === 'shop') {
          const item = this.shopData?.items.find(i => i.fruit.toLowerCase() === val.toLowerCase())
          if (item) this.handleBuy(item)
        }
      },
      next: () => this.advance(),
      reveal: () => {
        if (this.phase === 'play') this.doReveal()
        if (this.phase === 'sort') this.doSortReveal()
      },
      jump: () => {
        const to = Number(params.to)
        if (this.phase === 'learn') {
          this.introIdx = clamp(to, 0, this.intro.length - 1)
          this.wave = Math.floor(this.introIdx / WAVE_SIZE)
          this.render()
        } else if (this.phase === 'play') {
          this.idx = clamp(to, 0, this.challenges.length - 1)
          this.wave = Math.floor(this.idx / WAVE_SIZE)
          this.answered = false
          this.wrongAttempts = 0
          clearTimeout(this.advanceTimer)
          this.render()
        } else if (this.phase === 'sort') {
          this.sortIdx = clamp(to, 0, this.sortRounds.length - 1)
          this.initSortRound()
          this.render()
        }
      },
      end: () => this.finish(),
      set: () => {
        const field = String(params.field)
        if (field === 'score') { this.score = Number(params.value); this.updateHUD() }
        if (field === 'phase') {
          const val = String(params.value) as Phase
          if (['play', 'learn', 'sort', 'shop'].includes(val)) this.transitionTo(val)
        }
      },
    }
    actions[name]?.()
    this.sync()
  }

  getState() {
    if (this.phase === 'learn') {
      const item = this.intro[this.introIdx]
      return { phase: 'learn' as const, introIndex: this.introIdx, introTotal: this.intro.length, currentFruit: item?.fruit ?? '', wave: this.wave }
    }
    if (this.phase === 'sort') {
      return { phase: 'sort' as const, sortRound: this.sortIdx, sortTotal: this.sortRounds.length, remaining: this.sortRemaining.length, score: this.score }
    }
    if (this.phase === 'shop') {
      return { phase: 'shop' as const, budget: this.shopBudget, basketSize: this.shopBasket.length, basket: [...this.shopBasket], score: this.score }
    }
    const c = this.challenges[this.idx]
    return {
      phase: 'play' as const, challengeIndex: this.idx, score: this.score, total: this.challenges.length,
      streak: this.streak, answered: this.answered, isComplete: this.idx >= this.challenges.length, currentFruit: c?.fruit ?? '', wave: this.wave,
    }
  }

  destroy() {
    clearTimeout(this.advanceTimer)
    this.root.innerHTML = ''
  }

  // ===================== Phase Flow =====================

  /** How many learn→play waves exist (interleaves batches of WAVE_SIZE) */
  private get totalWaves(): number {
    if (this.intro.length === 0 || this.challenges.length === 0) return 1
    return Math.max(
      Math.ceil(this.intro.length / WAVE_SIZE),
      Math.ceil(this.challenges.length / WAVE_SIZE),
    )
  }

  private waveIntroEnd(): number {
    return Math.min((this.wave + 1) * WAVE_SIZE, this.intro.length)
  }

  private waveChallengeEnd(): number {
    return Math.min((this.wave + 1) * WAVE_SIZE, this.challenges.length)
  }

  private waveHasIntros(): boolean {
    return this.wave * WAVE_SIZE < this.intro.length
  }

  private waveHasChallenges(): boolean {
    return this.wave * WAVE_SIZE < this.challenges.length
  }

  private transitionTo(phase: Phase) {
    this.phase = phase
    sfxWhoosh()
    if (phase === 'learn') { this.wave = 0; this.introIdx = 0 }
    if (phase === 'play') { this.wave = 0; this.idx = 0; this.answered = false; this.wrongAttempts = 0 }
    if (phase === 'sort') { this.sortIdx = 0; this.initSortRound() }
    if (phase === 'shop') { this.shopBudget = this.shopData?.budget ?? 0; this.shopBasket = [] }
    this.render()
    this.sync()
    this.bridge.emitEvent('phaseChange', { phase })
  }

  /** Move to the next wave of learn→play, or on to sort/shop/finish */
  private advanceWave() {
    this.wave++
    if (this.wave < this.totalWaves) {
      if (this.waveHasIntros()) {
        this.phase = 'learn'
        this.introIdx = this.wave * WAVE_SIZE
        sfxWhoosh()
        this.render()
        this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'learn' })
      } else if (this.waveHasChallenges()) {
        this.phase = 'play'
        this.idx = this.wave * WAVE_SIZE
        this.answered = false
        this.wrongAttempts = 0
        sfxWhoosh()
        this.render()
        this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'play' })
      } else {
        this.advanceWave() // skip empty wave
      }
    } else {
      // All waves done → sort/shop/finish
      if (this.sortRounds.length > 0) this.transitionTo('sort')
      else if (this.shopData) this.transitionTo('shop')
      else this.finish()
    }
  }

  private advance() {
    clearTimeout(this.advanceTimer)

    if (this.phase === 'learn') {
      const wEnd = this.waveIntroEnd()
      if (this.introIdx < wEnd - 1) {
        this.introIdx++
        sfxPop()
        this.render()
        this.sync()
        this.bridge.emitEvent('introAdvance', { index: this.introIdx, fruit: this.intro[this.introIdx]?.fruit })
      } else if (this.waveHasChallenges()) {
        // Learn done for this wave → play
        this.phase = 'play'
        this.idx = this.wave * WAVE_SIZE
        this.answered = false
        this.wrongAttempts = 0
        sfxWhoosh()
        this.render()
        this.sync()
        this.bridge.emitEvent('phaseChange', { phase: 'play' })
      } else {
        this.advanceWave()
      }
      return
    }

    if (this.phase === 'play') {
      const wEnd = this.waveChallengeEnd()
      if (this.idx < wEnd - 1) {
        this.idx++
        this.answered = false
        this.wrongAttempts = 0
        this.render()
        this.sync()
      } else {
        this.advanceWave()
      }
      return
    }

    if (this.phase === 'sort') {
      if (this.sortIdx < this.sortRounds.length - 1) {
        this.sortIdx++
        this.initSortRound()
        this.render()
        this.sync()
      } else {
        if (this.shopData) this.transitionTo('shop')
        else this.finish()
      }
      return
    }

    if (this.phase === 'shop') {
      this.finish()
    }
  }

  // ===================== Rendering =====================

  private render() {
    switch (this.phase) {
      case 'learn': this.renderIntro(); break
      case 'play': this.renderChallenge(); break
      case 'sort': this.renderSort(); break
      case 'shop': this.renderShop(); break
    }
  }

  private renderIntro() {
    const item = this.intro[this.introIdx]
    if (!item) return
    this.root.innerHTML = ''

    const waveStart = this.wave * WAVE_SIZE
    const waveEnd = this.waveIntroEnd()
    const localIdx = this.introIdx - waveStart
    const waveCount = waveEnd - waveStart

    const phaseLabel = el('div', 'phase-label')
    phaseLabel.textContent = this.totalWaves > 1
      ? `Round ${this.wave + 1} — Let's learn!`
      : `Let's learn! ${localIdx + 1} / ${waveCount}`
    this.root.appendChild(phaseLabel)

    const card = el('div', 'intro-card')
    card.innerHTML = `
      <div class="intro-svg">${getFruitSvg(item.fruit)}</div>
      <h2 class="intro-title">${item.title || item.fruit}</h2>
      ${item.fact ? `<p class="intro-fact">${item.fact}</p>` : ''}
    `
    this.root.appendChild(card)

    const dots = el('div', 'progress-dots')
    for (let i = 0; i < waveCount; i++) {
      dots.appendChild(el('div', i < localIdx ? 'dot done' : i === localIdx ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)

    card.style.cursor = 'pointer'
    card.addEventListener('click', () => this.advance())
  }

  private renderChallenge() {
    const c = this.challenges[this.idx]
    if (!c) return
    this.root.innerHTML = ''

    const waveStart = this.wave * WAVE_SIZE
    const waveEnd = this.waveChallengeEnd()
    const localIdx = this.idx - waveStart
    const waveCount = waveEnd - waveStart

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">${this.totalWaves > 1 ? `Round ${this.wave + 1}: ` : ''}${localIdx + 1} / ${waveCount}</div>
      <div class="hud-right">${this.streak >= 2 ? '<span class="hud-streak">🔥 ' + this.streak + '</span>' : ''}</div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    hint.textContent = c.hint || `Find the ${c.fruit}!`
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid')
    const pool = c.pool || [c.fruit]
    grid.style.gridTemplateColumns = `repeat(${pool.length <= 4 ? 2 : pool.length <= 6 ? 3 : 4}, 1fr)`

    pool.forEach((fruitName, i) => {
      const card = el('div', 'fruit-card')
      card.style.animationDelay = `${i * 0.07}s`
      const inner = el('div', 'fruit-inner')
      const svgWrap = el('div', 'fruit-svg')
      svgWrap.innerHTML = getFruitSvg(fruitName)
      inner.appendChild(svgWrap)
      const label = el('span', 'fruit-label')
      label.textContent = fruitName
      inner.appendChild(label)
      card.appendChild(inner)

      if (!this.answered) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handlePick(fruitName, card))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    const dots = el('div', 'progress-dots')
    for (let i = 0; i < waveCount; i++) {
      dots.appendChild(el('div', i < localIdx ? 'dot done' : i === localIdx ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)
  }

  private renderSort() {
    const round = this.sortRounds[this.sortIdx]
    if (!round) return
    this.root.innerHTML = ''

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">Sort! ${this.sortRemaining.length} left</div>
      <div class="hud-right">${this.sortRounds.length > 1 ? `${this.sortIdx + 1}/${this.sortRounds.length}` : ''}</div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    hint.textContent = this.sortSelected
      ? `Where does the ${this.sortSelected} go?`
      : 'Tap a fruit, then pick its bin!'
    this.root.appendChild(hint)

    // Category bins
    const binsWrap = el('div', 'sort-bins')
    round.categories.forEach(cat => {
      const sortedCount = cat.fruits.filter(f => !this.sortRemaining.includes(f)).length
      const bin = el('div', 'sort-bin' + (this.sortSelected ? ' sort-bin-active' : ''))
      bin.innerHTML = `
        <div class="sort-bin-emoji">${cat.emoji || '📦'}</div>
        <div class="sort-bin-label">${cat.name}</div>
        <div class="sort-bin-count">${sortedCount} / ${cat.fruits.length}</div>
      `
      if (this.sortSelected) {
        bin.addEventListener('click', () => this.handleSort(this.sortSelected!, cat))
      }
      binsWrap.appendChild(bin)
    })
    this.root.appendChild(binsWrap)

    // Fruit grid
    if (this.sortRemaining.length > 0) {
      const grid = el('div', 'fruit-grid')
      const cols = this.sortRemaining.length <= 4 ? 2 : this.sortRemaining.length <= 6 ? 3 : 4
      grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

      this.sortRemaining.forEach((fruitName, i) => {
        const card = el('div', 'fruit-card' + (fruitName === this.sortSelected ? ' is-selected' : ''))
        card.style.animationDelay = `${i * 0.07}s`
        const inner = el('div', 'fruit-inner')
        const svgWrap = el('div', 'fruit-svg')
        svgWrap.innerHTML = getFruitSvg(fruitName)
        inner.appendChild(svgWrap)
        const label = el('span', 'fruit-label')
        label.textContent = fruitName
        inner.appendChild(label)
        card.appendChild(inner)
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => { this.sortSelected = fruitName; this.renderSort() })
        grid.appendChild(card)
      })
      this.root.appendChild(grid)
    }

    const dots = el('div', 'progress-dots')
    const total = round.fruits.length
    const done = total - this.sortRemaining.length
    for (let i = 0; i < total; i++) {
      dots.appendChild(el('div', i < done ? 'dot done' : i === done ? 'dot active' : 'dot'))
    }
    this.root.appendChild(dots)
  }

  private renderShop() {
    if (!this.shopData) return
    this.root.innerHTML = ''

    const available = this.shopData.items.filter(i => !this.shopBasket.includes(i.fruit))
    const cheapest = available.length > 0 ? Math.min(...available.map(i => i.price)) : Infinity
    const canBuyMore = this.shopBudget >= cheapest

    const hud = el('div', 'hud')
    hud.innerHTML = `
      <div class="hud-left"><span class="hud-star">★</span> <span class="hud-score-val">${this.score}</span></div>
      <div class="hud-center">🪙 ${this.shopBudget} coins</div>
      <div class="hud-right">🧺 ${this.shopBasket.length}</div>
    `
    this.root.appendChild(hud)

    const hint = el('div', 'challenge-hint')
    hint.textContent = !canBuyMore && this.shopBasket.length > 0
      ? 'Great shopping! 🎉'
      : (this.shopData.goal || 'Drag fruits into the basket!')
    this.root.appendChild(hint)

    const grid = el('div', 'fruit-grid')
    const items = this.shopData.items
    grid.style.gridTemplateColumns = `repeat(${items.length <= 4 ? 2 : items.length <= 6 ? 3 : 4}, 1fr)`

    items.forEach((item, i) => {
      const bought = this.shopBasket.includes(item.fruit)
      const canAfford = this.shopBudget >= item.price
      const card = el('div', 'fruit-card shop-item' + (bought ? ' is-bought' : '') + (!canAfford && !bought ? ' is-expensive' : ''))
      card.style.animationDelay = `${i * 0.07}s`

      const inner = el('div', 'fruit-inner')
      const svgWrap = el('div', 'fruit-svg')
      svgWrap.innerHTML = getFruitSvg(item.fruit)
      inner.appendChild(svgWrap)
      const label = el('span', 'fruit-label')
      label.textContent = item.fruit
      inner.appendChild(label)
      const price = el('span', 'shop-price')
      price.textContent = bought ? '✓ In basket' : `🪙 ${item.price}`
      inner.appendChild(price)
      card.appendChild(inner)

      if (!bought && canAfford) {
        card.addEventListener('pointerenter', () => sfxPop())
        card.addEventListener('click', () => this.handleBuy(item))
        card.style.touchAction = 'none'
        card.addEventListener('pointerdown', (e) => this.onDragStart(e, item.fruit, card))
      }
      grid.appendChild(card)
    })
    this.root.appendChild(grid)

    // Basket drop zone
    const dropZone = el('div', 'basket-drop-zone')
    const basketIcon = el('div', 'basket-icon')
    basketIcon.innerHTML = basketSvg
    dropZone.appendChild(basketIcon)

    if (this.shopBasket.length > 0) {
      const basketItems = el('div', 'basket-items')
      this.shopBasket.forEach(fruit => {
        const mini = el('span', 'shop-basket-svg')
        mini.innerHTML = getFruitSvg(fruit)
        basketItems.appendChild(mini)
      })
      dropZone.appendChild(basketItems)
    } else {
      const dropLabel = el('div', 'basket-drop-label')
      dropLabel.textContent = 'Drag fruits here!'
      dropZone.appendChild(dropLabel)
    }
    this.root.appendChild(dropZone)

    // Done button or auto-finish
    if (this.shopBasket.length > 0) {
      if (!canBuyMore) {
        this.advanceTimer = window.setTimeout(() => this.advance(), 2500)
      } else {
        const btn = el('button', 'shop-done-btn')
        btn.textContent = 'Done Shopping 🛒'
        btn.addEventListener('click', () => this.advance())
        this.root.appendChild(btn)
      }
    }
  }

  // ===================== Drag & Drop =====================

  private onDragStart(e: PointerEvent, fruit: string, card: HTMLElement) {
    if (this.dragEl) return
    e.preventDefault()
    card.setPointerCapture(e.pointerId)

    const rect = card.getBoundingClientRect()
    this.dragFruit = fruit
    this.dragOffsetX = e.clientX - rect.left
    this.dragOffsetY = e.clientY - rect.top

    // Create ghost
    const ghost = el('div', 'drag-ghost')
    ghost.innerHTML = getFruitSvg(fruit)
    ghost.style.width = `${rect.width * 0.8}px`
    ghost.style.height = `${rect.width * 0.8}px`
    ghost.style.left = `${e.clientX - this.dragOffsetX}px`
    ghost.style.top = `${e.clientY - this.dragOffsetY}px`
    document.body.appendChild(ghost)
    this.dragEl = ghost

    card.classList.add('is-dragging')
    sfxPop()

    const onMove = (ev: PointerEvent) => {
      if (!this.dragEl) return
      this.dragEl.style.left = `${ev.clientX - this.dragOffsetX}px`
      this.dragEl.style.top = `${ev.clientY - this.dragOffsetY}px`

      const dropZone = this.root.querySelector('.basket-drop-zone')
      if (dropZone) {
        const dzRect = dropZone.getBoundingClientRect()
        const over = ev.clientX >= dzRect.left && ev.clientX <= dzRect.right &&
                     ev.clientY >= dzRect.top && ev.clientY <= dzRect.bottom
        dropZone.classList.toggle('basket-hover', over)
      }
    }

    const onEnd = (ev: PointerEvent) => {
      card.removeEventListener('pointermove', onMove)
      card.removeEventListener('pointerup', onEnd)
      card.removeEventListener('pointercancel', onEnd)
      card.classList.remove('is-dragging')

      const dropZone = this.root.querySelector('.basket-drop-zone')
      if (dropZone) {
        const dzRect = dropZone.getBoundingClientRect()
        const over = ev.clientX >= dzRect.left && ev.clientX <= dzRect.right &&
                     ev.clientY >= dzRect.top && ev.clientY <= dzRect.bottom
        dropZone.classList.remove('basket-hover')

        if (over && this.dragFruit) {
          const item = this.shopData?.items.find(i => i.fruit === this.dragFruit)
          if (item) this.handleBuy(item)
        }
      }

      if (this.dragEl) {
        this.dragEl.remove()
        this.dragEl = null
      }
      this.dragFruit = null
    }

    card.addEventListener('pointermove', onMove)
    card.addEventListener('pointerup', onEnd)
    card.addEventListener('pointercancel', onEnd)
  }

  // ===================== Interaction =====================

  private handlePick(fruitName: string, card: HTMLElement) {
    if (this.answered) return
    const c = this.challenges[this.idx]
    if (!c) return

    const isCorrect = fruitName.toLowerCase() === c.fruit.toLowerCase()

    if (isCorrect) {
      this.answered = true
      this.score += 10
      this.streak++
      card.classList.add('is-correct')
      sfxCorrect()
      setTimeout(() => sfxCoin(), 350)
      this.burstParticles(card)
      this.floatScore(card, '+10')
      this.updateHUD()

      this.root.querySelectorAll<HTMLElement>('.fruit-card').forEach(c => {
        if (c !== card) c.classList.add('is-dimmed')
      })

      this.bridge.emitEvent('correctAnswer', {
        challengeIndex: this.idx, expected: c.fruit, given: fruitName, score: this.score,
      })
      this.sync()
      this.advanceTimer = window.setTimeout(() => this.advance(), 1800)
    } else {
      this.wrongAttempts++
      card.classList.add('is-wrong')
      sfxWrong()
      setTimeout(() => card.classList.remove('is-wrong'), 500)
      this.streak = 0
      this.updateHUD()

      this.bridge.emitEvent('incorrectAnswer', {
        challengeIndex: this.idx, expected: c.fruit, given: fruitName, score: this.score,
      })

      if (this.wrongAttempts >= 3) this.doReveal()
    }
  }

  private doReveal() {
    if (this.answered) return
    this.answered = true
    const c = this.challenges[this.idx]
    if (!c) return
    sfxWhoosh()

    const pool = c.pool || []
    const cards = this.root.querySelectorAll<HTMLElement>('.fruit-card')
    pool.forEach((name, i) => {
      if (name.toLowerCase() === c.fruit.toLowerCase()) {
        cards[i]?.classList.add('is-revealed')
      } else {
        cards[i]?.classList.add('is-dimmed')
      }
    })

    this.sync()
    this.advanceTimer = window.setTimeout(() => this.advance(), 2200)
  }

  private initSortRound() {
    const round = this.sortRounds[this.sortIdx]
    if (!round) return
    this.sortRemaining = [...round.fruits].sort(() => Math.random() - 0.5)
    this.sortSelected = null
  }

  private handleSort(fruitName: string, category: SortCategory) {
    const isCorrect = category.fruits.some(f => f.toLowerCase() === fruitName.toLowerCase())

    if (isCorrect) {
      this.sortRemaining = this.sortRemaining.filter(f => f !== fruitName)
      this.score += 5
      this.sortSelected = null
      sfxCorrect()
      setTimeout(() => sfxCoin(), 200)
      this.bridge.emitEvent('correctSort', { fruit: fruitName, category: category.name, score: this.score })

      if (this.sortRemaining.length === 0) {
        this.bridge.emitEvent('sortRoundComplete', { round: this.sortIdx, score: this.score })
        this.advanceTimer = window.setTimeout(() => this.advance(), 1200)
      }
      this.renderSort()
    } else {
      sfxWrong()
      const bins = this.root.querySelectorAll('.sort-bin')
      const round = this.sortRounds[this.sortIdx]
      if (round) {
        const catIdx = round.categories.indexOf(category)
        if (catIdx >= 0 && bins[catIdx]) {
          bins[catIdx].classList.add('is-wrong')
          setTimeout(() => bins[catIdx].classList.remove('is-wrong'), 500)
        }
      }
      this.bridge.emitEvent('incorrectSort', { fruit: fruitName, category: category.name })
    }
    this.sync()
  }

  private doSortReveal() {
    const round = this.sortRounds[this.sortIdx]
    if (!round || this.sortRemaining.length === 0) return
    const fruit = this.sortSelected || this.sortRemaining[0]
    const cat = round.categories.find(c => c.fruits.some(f => f.toLowerCase() === fruit.toLowerCase()))
    if (!cat) return

    sfxWhoosh()
    this.sortSelected = fruit
    this.renderSort()

    const bins = this.root.querySelectorAll('.sort-bin')
    const catIdx = round.categories.indexOf(cat)
    if (catIdx >= 0 && bins[catIdx]) bins[catIdx].classList.add('is-revealed')

    this.advanceTimer = window.setTimeout(() => this.handleSort(fruit, cat), 1500)
  }

  private handleBuy(item: ShopItem) {
    if (this.shopBasket.includes(item.fruit) || this.shopBudget < item.price) return
    clearTimeout(this.advanceTimer)
    this.shopBasket.push(item.fruit)
    this.shopBudget -= item.price
    this.score += 5
    sfxCoin()
    this.bridge.emitEvent('itemBought', { fruit: item.fruit, price: item.price, budget: this.shopBudget, basket: [...this.shopBasket] })
    this.renderShop()
    this.sync()
  }

  private finish() {
    clearTimeout(this.advanceTimer)
    sfxComplete()
    this.bridge.emitEvent('gameCompleted', { score: this.score, total: this.challenges.length })
    this.bridge.endGame({ outcome: 'completed', finalScore: this.score })

    const maxScore = this.challenges.length * 10
      + this.sortRounds.reduce((sum, r) => sum + r.fruits.length * 5, 0)
      + (this.shopData?.items.length ?? 0) * 5

    this.root.innerHTML = ''
    const screen = el('div', 'end-screen')
    let details = ''
    if (this.streak >= 2) details += `<div class="end-detail">🔥 Best streak: ${this.streak}</div>`
    if (this.shopBasket.length > 0) details += `<div class="end-detail">🧺 Bought ${this.shopBasket.length} fruits</div>`

    screen.innerHTML = `
      <div class="end-trophy">🏆</div>
      <h2 class="end-title">Great Job!</h2>
      <div class="end-score">
        <span class="end-star">★</span> ${this.score} <span class="end-max">/ ${maxScore}</span>
      </div>
      ${details}
    `
    this.root.appendChild(screen)
  }

  // ===================== Effects =====================

  private updateHUD() {
    const scoreEl = this.root.querySelector('.hud-score-val')
    if (scoreEl) {
      scoreEl.textContent = String(this.score)
      scoreEl.classList.remove('pulse')
      void (scoreEl as HTMLElement).offsetWidth
      scoreEl.classList.add('pulse')
    }
    const streakEl = this.root.querySelector('.hud-right')
    if (streakEl) {
      streakEl.innerHTML = this.streak >= 2 ? `<span class="hud-streak">🔥 ${this.streak}</span>` : ''
    }
  }

  private burstParticles(card: HTMLElement) {
    const rect = card.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF922B', '#CC5DE8']

    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.3
      const dist = 50 + Math.random() * 60
      p.style.setProperty('--px', `${Math.cos(angle) * dist}px`)
      p.style.setProperty('--py', `${Math.sin(angle) * dist}px`)
      p.style.left = `${cx}px`
      p.style.top = `${cy}px`
      p.style.background = colors[i % colors.length]
      p.style.width = p.style.height = `${6 + Math.random() * 6}px`
      document.body.appendChild(p)
      p.addEventListener('animationend', () => p.remove())
    }
  }

  private floatScore(card: HTMLElement, text: string) {
    const rect = card.getBoundingClientRect()
    const f = document.createElement('div')
    f.className = 'float-score'
    f.textContent = text
    f.style.left = `${rect.left + rect.width / 2}px`
    f.style.top = `${rect.top}px`
    document.body.appendChild(f)
    f.addEventListener('animationend', () => f.remove())
  }

  private sync() {
    this.bridge.updateState(this.getState())
  }
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
