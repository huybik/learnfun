/** SVG registry — loads all fruit & drink SVGs from assets/ at build time. */

const svgModules = import.meta.glob('./assets/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

// Build lookup: "apple" → "<svg ...>...</svg>"
const allSvgs: Record<string, string> = {}
for (const [path, raw] of Object.entries(svgModules)) {
  const name = path.replace('./assets/', '').replace('.svg', '')
  allSvgs[name] = raw
}

const DRINK_IDS = [
  'apple-juice', 'tropical-smoothie', 'berry-blast', 'citrus-sunrise',
  'green-machine', 'watermelon-cooler', 'coconut-paradise', 'grape-fizz',
]

export const FRUIT_NAMES = Object.keys(allSvgs).filter(n => !DRINK_IDS.includes(n) && n !== 'basket')
export const DRINK_NAMES = DRINK_IDS.filter(n => n in allSvgs)

export function getFruitSvg(name: string): string {
  return allSvgs[name] ?? ''
}

export function getDrinkSvg(name: string): string {
  return allSvgs[name] ?? ''
}
