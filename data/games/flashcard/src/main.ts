import { GameBridge } from '@learnfun/game-sdk'
import { FlashcardGame } from './game'
import './style.css'

const root = document.getElementById('game')!

const bridge = new GameBridge({
  actions: [
    { name: 'submit', params: { value: 'string' }, description: 'Submit an answer' },
    { name: 'next', description: 'Advance to next card' },
    { name: 'reveal', description: 'Reveal answer without scoring', godMode: true },
    { name: 'jump', params: { to: 'number' }, description: 'Jump to card index', godMode: true },
    { name: 'end', description: 'End game immediately', godMode: true },
    { name: 'set', params: { field: 'string', value: 'string' }, description: 'Override game field', godMode: true },
  ],
  defaultInitData: {
    sub_type: 'SentenceCompletion',
    cards: [
      { id: 1, sentence_template: 'The ____ is shining brightly today.', missing_word: 'sun', options: ['sun', 'moon', 'star', 'cloud'] },
      { id: 2, sentence_template: 'I like to eat ____ for breakfast.', missing_word: 'eggs', options: ['eggs', 'rocks', 'paper', 'shoes'] },
      { id: 3, sentence_template: 'The cat sat on the ____.', missing_word: 'mat', options: ['mat', 'bat', 'hat', 'rat'] },
      { id: 4, sentence_template: 'Water freezes at zero degrees ____.', missing_word: 'Celsius', options: ['Celsius', 'meters', 'grams', 'liters'] },
      { id: 5, sentence_template: 'The ____ is the largest planet in our solar system.', missing_word: 'Jupiter', options: ['Jupiter', 'Mars', 'Venus', 'Saturn'] },
    ],
  },
})

const game = new FlashcardGame(root, bridge)
bridge.register(game)
