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
      // Wave 1
      { fruit: 'apple', title: 'Meet the Apple!', fact: 'Apples are crunchy and come in red, green, and yellow!' },
      { fruit: 'banana', title: 'Meet the Banana!', fact: 'Bananas are curved, yellow, and full of energy!' },
      { fruit: 'watermelon', title: 'Meet the Watermelon!', fact: 'Watermelons are huge, green outside, and red inside!' },
      { fruit: 'grape', title: 'Meet the Grape!', fact: 'Grapes are tiny and grow in bunches on vines!' },
      // Wave 2
      { fruit: 'pineapple', title: 'Meet the Pineapple!', fact: 'Pineapples are spiky on the outside and sweet on the inside!' },
      { fruit: 'strawberry', title: 'Meet the Strawberry!', fact: 'Strawberries are the only fruit with seeds on the outside!' },
      { fruit: 'mango', title: 'Meet the Mango!', fact: 'Mangoes are called the king of fruits!' },
      { fruit: 'cherry', title: 'Meet the Cherry!', fact: 'Cherries always grow in pairs on a stem!' },
    ],
    challenges: [
      // Wave 1
      { id: 1, fruit: 'apple', hint: '🍎 Find the crunchy red fruit that keeps the doctor away!', pool: ['apple', 'cherry', 'strawberry', 'peach', 'pear', 'orange'] },
      { id: 2, fruit: 'banana', hint: '🐒 Find the yellow curved fruit that monkeys love!', pool: ['banana', 'lemon', 'mango', 'pineapple', 'pear', 'kiwi'] },
      { id: 3, fruit: 'watermelon', hint: '🏖️ Find the BIG green fruit that is red and juicy inside!', pool: ['watermelon', 'coconut', 'avocado', 'kiwi', 'grape', 'pineapple'] },
      { id: 4, fruit: 'grape', hint: '🍇 Find the tiny fruit that grows in bunches on vines!', pool: ['grape', 'blueberry', 'cherry', 'pear', 'strawberry', 'orange'] },
      // Wave 2
      { id: 5, fruit: 'pineapple', hint: '🏝️ Find the spiky tropical fruit with a crown on top!', pool: ['pineapple', 'coconut', 'mango', 'lemon', 'avocado', 'kiwi'] },
      { id: 6, fruit: 'strawberry', hint: '❤️ Find the small red heart-shaped fruit with tiny seeds!', pool: ['strawberry', 'cherry', 'apple', 'peach', 'blueberry', 'grape'] },
      { id: 7, fruit: 'mango', hint: '👑 Find the tropical fruit that is called the king of fruits!', pool: ['mango', 'pineapple', 'peach', 'orange', 'pear', 'kiwi'] },
      { id: 8, fruit: 'cherry', hint: '🍒 Find the tiny red fruit that grows in pairs!', pool: ['cherry', 'strawberry', 'grape', 'blueberry', 'apple', 'cranberry'] },
    ],
    sort: [
      {
        fruits: ['apple', 'cherry', 'banana', 'lemon', 'grape', 'blueberry'],
        categories: [
          { name: 'Red Fruits', emoji: '🔴', fruits: ['apple', 'cherry'] },
          { name: 'Yellow Fruits', emoji: '🟡', fruits: ['banana', 'lemon'] },
          { name: 'Blue & Purple', emoji: '🟣', fruits: ['grape', 'blueberry'] },
        ],
      },
    ],
    memory: [
      { fruits: ['apple', 'banana', 'grape', 'cherry'] },
    ],
    oddoneout: [
      { fruits: ['apple', 'cherry', 'strawberry', 'banana'], odd: 'banana', trait: 'red fruit', explanation: 'Banana is yellow — the rest are red!' },
      { fruits: ['watermelon', 'pineapple', 'grape', 'coconut'], odd: 'grape', trait: 'big fruit', explanation: 'Grapes are tiny — the rest are big!' },
    ],
    pattern: [
      { sequence: ['apple', 'banana', 'apple', 'banana'], answer: 'apple', options: ['apple', 'grape', 'banana', 'cherry'] },
      { sequence: ['cherry', 'cherry', 'grape', 'cherry', 'cherry'], answer: 'grape', options: ['cherry', 'grape', 'apple', 'lemon'] },
    ],
    shop: {
      budget: 100,
      goal: 'Buy fruits for a delicious smoothie! 🥤',
      items: [
        { fruit: 'strawberry', price: 15 },
        { fruit: 'banana', price: 10 },
        { fruit: 'mango', price: 20 },
        { fruit: 'blueberry', price: 12 },
        { fruit: 'coconut', price: 25 },
        { fruit: 'pineapple', price: 18 },
      ],
    },
    recipes: [
      {
        name: 'Tropical Smoothie',
        emoji: '🥤',
        required: ['mango', 'pineapple', 'banana'],
        budget: 80,
        available: [
          { fruit: 'mango', price: 20 },
          { fruit: 'pineapple', price: 18 },
          { fruit: 'banana', price: 10 },
          { fruit: 'apple', price: 12 },
          { fruit: 'grape', price: 8 },
          { fruit: 'coconut', price: 25 },
        ],
      },
    ],
  },
})

const game = new FruitMarketGame(root, bridge)
bridge.register(game)
