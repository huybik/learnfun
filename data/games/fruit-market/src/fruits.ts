/** Fruit SVG registry — loads all SVGs from assets/ at build time. */

const svgModules = import.meta.glob('./assets/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

// Build lookup: "apple" → "<svg ...>...</svg>"
const fruitSvgs: Record<string, string> = {}
for (const [path, raw] of Object.entries(svgModules)) {
  const name = path.replace('./assets/', '').replace('.svg', '')
  fruitSvgs[name] = raw
}

export const FRUIT_NAMES = Object.keys(fruitSvgs)

export function getFruitSvg(name: string): string {
  return fruitSvgs[name] ?? ''
}
