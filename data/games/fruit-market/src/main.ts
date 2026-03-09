import { GameBridge } from '@learnfun/game-sdk'
import { FruitMarketGame } from './game'
import './style.css'

const root = document.getElementById('game')!

const bridge = new GameBridge({
  actions: [
    { name: 'submit', params: { value: 'string' }, description: 'Submit a fruit name' },
    { name: 'next', description: 'Advance to next challenge' },
    { name: 'reveal', description: 'Reveal the answer without scoring', godMode: true },
    { name: 'jump', params: { to: 'number' }, description: 'Jump to a specific challenge', godMode: true },
    { name: 'end', description: 'End the game immediately', godMode: true },
    { name: 'set', params: { field: 'string', value: 'string' }, description: 'Override a game field', godMode: true },
  ],
  defaultInitData: {
    fruits: {
      apple: { title: 'Meet the Apple!', fact: 'Apples are crunchy and come in red, green, and yellow!', hint: '🍎 Find the crunchy red fruit that keeps the doctor away!' },
      banana: { title: 'Meet the Banana!', fact: 'Bananas are curved, yellow, and full of energy!', hint: '🐒 Find the yellow curved fruit that monkeys love!' },
      orange: { title: 'Meet the Orange!', fact: 'Oranges are round, orange, and full of vitamin C!', hint: '🍊 Find the round orange fruit full of vitamin C!' },
      strawberry: { title: 'Meet the Strawberry!', fact: 'Strawberries are the only fruit with seeds on the outside!', hint: '❤️ Find the small red heart-shaped fruit with tiny seeds!' },
      grape: { title: 'Meet the Grape!', fact: 'Grapes are tiny and grow in bunches on vines!', hint: '🍇 Find the tiny fruit that grows in bunches on vines!' },
      watermelon: { title: 'Meet the Watermelon!', fact: 'Watermelons are huge, green outside, and red inside!', hint: '🏖️ Find the BIG green fruit that is red and juicy inside!' },
      pineapple: { title: 'Meet the Pineapple!', fact: 'Pineapples are spiky on the outside and sweet on the inside!', hint: '🏝️ Find the spiky tropical fruit with a crown on top!' },
      mango: { title: 'Meet the Mango!', fact: 'Mangoes are called the king of fruits!', hint: '👑 Find the tropical fruit that is called the king of fruits!' },
      cherry: { title: 'Meet the Cherry!', fact: 'Cherries always grow in pairs on a stem!', hint: '🍒 Find the tiny red fruit that grows in pairs!' },
      lemon: { title: 'Meet the Lemon!', fact: 'Lemons are super sour and bright yellow!', hint: '🍋 Find the sour yellow fruit that makes you pucker!' },
      peach: { title: 'Meet the Peach!', fact: 'Peaches have fuzzy skin and a big pit inside!', hint: '🍑 Find the fuzzy fruit that is soft and sweet!' },
      pear: { title: 'Meet the Pear!', fact: 'Pears are shaped like a bell and very juicy!', hint: '🍐 Find the bell-shaped green fruit!' },
      kiwi: { title: 'Meet the Kiwi!', fact: 'Kiwis are fuzzy brown outside and bright green inside!', hint: '🥝 Find the small fuzzy fruit that is green inside!' },
      coconut: { title: 'Meet the Coconut!', fact: 'Coconuts are hard on the outside and have sweet water inside!', hint: '🥥 Find the big brown fruit with water inside!' },
      blueberry: { title: 'Meet the Blueberry!', fact: 'Blueberries are tiny, round, and packed with vitamins!', hint: '💙 Find the tiny round blue fruit!' },
      avocado: { title: 'Meet the Avocado!', fact: 'Avocados are creamy inside and great on toast!', hint: '🥑 Find the green fruit that is creamy inside!' },
    },
  },
})

const game = new FruitMarketGame(root, bridge)
bridge.register(game)
