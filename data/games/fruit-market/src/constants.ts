import type { DrinkRecipe, MiniGame } from './types'

export const WAVE_SIZE = 3
export const TOTAL_WAVES = 3
export const FRUIT_PRICE = 10
export const STARTER_FRUITS = ['apple', 'banana', 'orange']
export const ALL_MINI_GAMES: MiniGame[] = ['memory', 'pattern', 'oddoneout', 'sort', 'juice']

export const FRUIT_COLORS: Record<string, string> = {
  apple: 'red', cherry: 'red', strawberry: 'red',
  banana: 'yellow', lemon: 'yellow', pineapple: 'yellow',
  orange: 'orange', mango: 'orange', peach: 'orange',
  grape: 'purple', blueberry: 'purple',
  watermelon: 'green', kiwi: 'green', avocado: 'green', pear: 'green',
  coconut: 'brown',
}

export const COLOR_EMOJIS: Record<string, string> = {
  red: '🔴', yellow: '🟡', orange: '🟠', purple: '🟣', green: '🟢', brown: '🟤',
}

export const COLOR_NAMES: Record<string, string> = {
  red: 'Red', yellow: 'Yellow', orange: 'Orange', purple: 'Purple', green: 'Green', brown: 'Brown',
}

export const DRINK_RECIPES: DrinkRecipe[] = [
  { name: 'Fruit Punch', drink: 'fruit-punch', fruits: ['apple', 'banana'] },
  { name: 'Apple Juice', drink: 'apple-juice', fruits: ['apple', 'lemon'] },
  { name: 'Tropical Smoothie', drink: 'tropical-smoothie', fruits: ['mango', 'pineapple', 'banana'] },
  { name: 'Berry Blast', drink: 'berry-blast', fruits: ['strawberry', 'blueberry', 'cherry'] },
  { name: 'Citrus Sunrise', drink: 'citrus-sunrise', fruits: ['orange', 'lemon', 'peach'] },
  { name: 'Green Machine', drink: 'green-machine', fruits: ['kiwi', 'avocado', 'pear'] },
  { name: 'Watermelon Cooler', drink: 'watermelon-cooler', fruits: ['watermelon', 'strawberry'] },
  { name: 'Coconut Paradise', drink: 'coconut-paradise', fruits: ['coconut', 'pineapple', 'mango'] },
  { name: 'Grape Fizz', drink: 'grape-fizz', fruits: ['grape', 'blueberry'] },
]

export const BIN_COLORS: Record<string, [string, string]> = {
  '🔴': ['#EF9A9A', '#C62828'],
  '🟡': ['#FFF176', '#F9A825'],
  '🟣': ['#CE93D8', '#7B1FA2'],
  '🟢': ['#A5D6A7', '#2E7D32'],
  '🔵': ['#90CAF9', '#1565C0'],
  '🟠': ['#FFCC80', '#E65100'],
  '🟤': ['#BCAAA4', '#4E342E'],
}

export function coloredBasket(idx: number, light: string, dark: string): string {
  const g = `cb${idx}`
  return `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${g}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${light}"/><stop offset="100%" stop-color="${dark}"/>
    </linearGradient></defs>
    <path d="M34,52 C34,20 94,20 94,52" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round"/>
    <path d="M34,52 C34,24 94,24 94,52" fill="none" stroke="${light}" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
    <path d="M18,56 L28,108 C30,114 36,118 42,118 L86,118 C92,118 98,114 100,108 L110,56 Z" fill="url(#${g})"/>
    <line x1="22" y1="68" x2="106" y2="68" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
    <line x1="24" y1="80" x2="104" y2="80" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
    <line x1="26" y1="92" x2="102" y2="92" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
    <line x1="28" y1="104" x2="100" y2="104" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
    <line x1="40" y1="56" x2="36" y2="118" stroke="${dark}" stroke-width="1.5" opacity="0.25"/>
    <line x1="56" y1="56" x2="52" y2="118" stroke="${dark}" stroke-width="1.5" opacity="0.25"/>
    <line x1="72" y1="56" x2="72" y2="118" stroke="${dark}" stroke-width="1.5" opacity="0.25"/>
    <line x1="88" y1="56" x2="88" y2="118" stroke="${dark}" stroke-width="1.5" opacity="0.25"/>
    <rect x="16" y="52" width="96" height="10" rx="5" fill="${dark}"/>
    <rect x="20" y="53" width="88" height="3" rx="1.5" fill="white" opacity="0.3"/>
    <path d="M22,62 L110,62 L108,66 L20,66 Z" fill="${dark}" opacity="0.15"/>
  </svg>`
}
