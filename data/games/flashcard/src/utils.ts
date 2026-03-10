export function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
