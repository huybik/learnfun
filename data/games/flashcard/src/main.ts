import { GameBridge } from '@learnfun/game-sdk'
import { FlashcardGame } from './game'
import './style.css'

const root = document.getElementById('game')!

const bridge = new GameBridge({
  actions: [
    { name: 'submitAnswer', params: { answer: 'string' }, description: 'Submit an answer for the current card' },
    { name: 'nextCard', description: 'Advance to the next card' },
    { name: 'revealAnswer', description: 'Reveal the answer without scoring', godMode: true },
    { name: 'setScore', params: { score: 'number' }, description: 'Set the score', godMode: true },
    { name: 'setCardIndex', params: { index: 'number' }, description: 'Jump to a specific card', godMode: true },
    { name: 'skipToEnd', description: 'End the game immediately', godMode: true },
  ],
  defaultInitData: {
    sub_type: 'SentenceCompletion',
    cards: [
      { id: 1, sentence_template: 'The ____ is shining brightly today.', missing_word: 'sun', options: ['sun', 'moon', 'star', 'cloud'] },
      { id: 2, sentence_template: 'I like to eat ____ for breakfast.', missing_word: 'eggs', options: ['eggs', 'rocks', 'paper', 'shoes'] },
      { id: 3, sentence_template: 'The cat sat on the ____.', missing_word: 'mat', options: ['mat', 'bat', 'hat', 'rat'] },
    ],
  },
})

const game = new FlashcardGame(root, bridge)
bridge.register(game)
