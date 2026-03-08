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
    mode: 'identify',
    challenges: [
      { id: 1, fruit: 'apple', hint: 'This red fruit keeps the doctor away', options: ['apple', 'cherry', 'strawberry', 'peach'] },
      { id: 2, fruit: 'banana', hint: 'Yellow and curved, monkeys love it', options: ['banana', 'lemon', 'mango', 'pineapple'] },
      { id: 3, fruit: 'watermelon', hint: 'Big, green outside, red inside with seeds', options: ['watermelon', 'coconut', 'avocado', 'kiwi'] },
      { id: 4, fruit: 'grape', hint: 'Small and round, grows in bunches on vines', options: ['grape', 'blueberry', 'cherry', 'pear'] },
    ],
  },
})

const game = new FruitMarketGame(root, bridge)
bridge.register(game)
