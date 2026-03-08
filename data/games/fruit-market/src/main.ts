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
    intro: [
      { fruit: 'apple', title: 'Meet the Apple!', fact: 'Apples are crunchy and come in red, green, and yellow!' },
      { fruit: 'banana', title: 'Meet the Banana!', fact: 'Bananas are curved, yellow, and full of energy!' },
      { fruit: 'watermelon', title: 'Meet the Watermelon!', fact: 'Watermelons are huge, green outside, and red inside!' },
    ],
    challenges: [
      { id: 1, fruit: 'apple', hint: '🍎 Find the crunchy red fruit that keeps the doctor away!', pool: ['apple', 'cherry', 'strawberry', 'peach', 'pear', 'orange'] },
      { id: 2, fruit: 'banana', hint: '🐒 Find the yellow curved fruit that monkeys love!', pool: ['banana', 'lemon', 'mango', 'pineapple', 'pear', 'kiwi'] },
      { id: 3, fruit: 'watermelon', hint: '🏖️ Find the BIG green fruit that is red and juicy inside!', pool: ['watermelon', 'coconut', 'avocado', 'kiwi', 'grape', 'pineapple'] },
      { id: 4, fruit: 'grape', hint: '🍇 Find the tiny fruit that grows in bunches on vines!', pool: ['grape', 'blueberry', 'cherry', 'pear', 'strawberry', 'orange'] },
      { id: 5, fruit: 'pineapple', hint: '🏝️ Find the spiky tropical fruit with a crown on top!', pool: ['pineapple', 'coconut', 'mango', 'lemon', 'avocado', 'kiwi'] },
      { id: 6, fruit: 'strawberry', hint: '❤️ Find the small red heart-shaped fruit with tiny seeds!', pool: ['strawberry', 'cherry', 'apple', 'peach', 'blueberry', 'grape'] },
    ],
  },
})

const game = new FruitMarketGame(root, bridge)
bridge.register(game)
