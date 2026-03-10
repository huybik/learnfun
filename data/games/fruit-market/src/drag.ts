import { getFruitSvg } from './fruits'
import { sfxPop } from './audio'
import { el } from './utils'

let dragEl: HTMLElement | null = null
let dragOffsetX = 0
let dragOffsetY = 0

export function startDrag(
  root: HTMLElement,
  e: PointerEvent,
  fruit: string,
  card: HTMLElement,
  dropSelector: string,
  onDrop: (target: HTMLElement) => void,
) {
  if (dragEl) return
  card.setPointerCapture(e.pointerId)

  const startX = e.clientX, startY = e.clientY
  const rect = card.getBoundingClientRect()
  dragOffsetX = e.clientX - rect.left
  dragOffsetY = e.clientY - rect.top
  let dragging = false

  const onMove = (ev: PointerEvent) => {
    if (!dragging && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 8) {
      dragging = true
      const ghost = el('div', 'drag-ghost')
      ghost.innerHTML = getFruitSvg(fruit)
      ghost.style.width = `${rect.width * 0.8}px`
      ghost.style.height = `${rect.width * 0.8}px`
      document.body.appendChild(ghost)
      dragEl = ghost
      card.classList.add('is-dragging')
      sfxPop()
    }
    if (dragging && dragEl) {
      ev.preventDefault()
      dragEl.style.left = `${ev.clientX - dragOffsetX}px`
      dragEl.style.top = `${ev.clientY - dragOffsetY}px`
      root.querySelectorAll<HTMLElement>(dropSelector).forEach(dz => {
        const r = dz.getBoundingClientRect()
        dz.classList.toggle('drop-hover', ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom)
      })
    }
  }

  const onEnd = (ev: PointerEvent) => {
    card.removeEventListener('pointermove', onMove)
    card.removeEventListener('pointerup', onEnd)
    card.removeEventListener('pointercancel', onEnd)
    card.classList.remove('is-dragging')
    if (dragging) {
      root.querySelectorAll<HTMLElement>(dropSelector).forEach(dz => {
        const r = dz.getBoundingClientRect()
        const over = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
        dz.classList.remove('drop-hover')
        if (over) onDrop(dz)
      })
    }
    if (dragEl) { dragEl.remove(); dragEl = null }
  }

  card.addEventListener('pointermove', onMove)
  card.addEventListener('pointerup', onEnd)
  card.addEventListener('pointercancel', onEnd)
}
