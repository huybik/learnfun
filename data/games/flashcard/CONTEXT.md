# Flashcard — Game Context

Minimal flashcard game: show a card, answer, get feedback, next. Two modes.

## Architecture

Single-class game (`FlashcardGame`) implementing `GameAPI`. Vanilla TS, no framework. ~220 lines of logic.

## Files

```
flashcard/
├── src/
│   ├── main.ts       — GameBridge setup, action definitions, default data
│   ├── game.ts       — FlashcardGame class (all game logic + rendering)
│   └── style.css     — Dark theme styling (137 lines)
├── skill.md          — TA documentation & data specs
├── index.html        — DOM anchor
├── vite.config.ts    — Build config (base: './')
├── package.json      — Dependencies (@learnfun/game-sdk)
└── dist/             — Built output
```

## Modes

- **SentenceCompletion**: Template with `____` blank → fill in word (options buttons or free text)
- **ImageToWord**: Base64 image → type the word

## State

```
{ mode, cardIndex, score, total, answered, isComplete, currentAnswer }
```

- Score: +10 per correct answer, never decreases
- Linear progression: card 0 → card N → finish

## Data Format (from TA)

```json
{ "sub_type": "SentenceCompletion", "cards": [{ "id": 1, "sentence_template": "The ____ is red.", "missing_word": "apple", "options": ["apple","car","dog"] }] }
```

## Events

gameStarted, correctAnswer, incorrectAnswer, gameCompleted

## Actions

Player: submit(value), next
Teacher: reveal, jump(to), end, set(field, value)

## Visual Design

- Dark theme (#111 bg, #1a1a2e cards)
- Accent blue (#7c8aff) for blanks/score
- Green/red/orange feedback colors
- No animations beyond hover transitions
- No audio, no particles, no assets
- System font, 480px max-width
