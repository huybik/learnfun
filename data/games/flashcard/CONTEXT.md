# Flashcard — Game Context

Multi-phase flashcard game with learn, quiz, speed round, memory match, and stats. Two content modes.

## Architecture

`FlashcardGame` class implementing `GameAPI`. Vanilla TS, no framework. Modular: game engine + 5 phase renderers + shared utilities.

## Files

```
flashcard/
├── src/
│   ├── main.ts          — GameBridge setup, action definitions, 5 default cards
│   ├── game.ts          — FlashcardGame class (GameAPI, state, phase transitions)
│   ├── types.ts         — TypeScript interfaces (Card, GameState, GameCtx, MatchCard)
│   ├── constants.ts     — Game constants (points, timers, limits)
│   ├── utils.ts         — DOM helpers (el, shuffle, clamp)
│   ├── audio.ts         — Web Audio synth SFX (no asset files)
│   ├── ui.ts            — Shared UI (HUD, dots, particles, floating scores)
│   ├── style.css        — Warm theme (lavender gradient, Fredoka font, 655 lines)
│   ├── phases/
│   │   ├── learn.ts     — Preview cards with answers visible
│   │   ├── quiz.ts      — Standard Q&A with streaks/particles
│   │   ├── speed.ts     — Timed quiz with countdown bar + time bonus
│   │   ├── match.ts     — Memory card matching (term ↔ definition)
│   │   └── end.ts       — Stats screen (accuracy, streak, mastery stars)
│   └── assets/          — Generated SVGs (via generate_svgs.py)
├── generate_svgs.py     — Gemini Flash SVG generator (8 decorative assets)
├── skill.md             — TA documentation & data specs
├── index.html, vite.config.ts, package.json, tsconfig.json
└── dist/                — Built output
```

## Game Flow

learn → quiz → mini-game 1 → mini-game 2 → end

Mini-games: `speed` and `match` in random order (both always played).

## Modes

- **SentenceCompletion**: Template with `____` blank → fill in word (options or free text)
- **ImageToWord**: Base64 image → type the word

## State

```
{ phase, mode, score, streak, bestStreak, totalCorrect, totalAnswered,
  cards, cardIndex, answered, wasCorrect, wrongAttempts,
  miniGames, miniGameIndex, timerStart, timerDuration, speedTimerId,
  matchCards, matchFlipped, matchMatched, matchLocked, mastery, advanceTimer }
```

## Key Patterns

- **GameCtx**: Shared context passed to all phases (root, bridge, state, render, sync, advance, checkAnswer)
- **Phase renderers**: Each exports `render{Phase}(ctx)`, clears root, builds DOM, attaches event listeners
- **Incremental DOM**: Match phase uses class toggling instead of full re-render (preserves card positions)
- **Timer management**: Centralized in game.ts (clearSpeedTimer, clearTimers)
- **checkAnswer**: On GameCtx, used by quiz + speed phases. Handles scoring, streaks, mastery, events. Returns boolean.
- **Effects**: Particles + float scores use position:fixed on body (survive re-render)
- **Audio**: Web Audio oscillators (sfxCorrect, sfxWrong, sfxFlip, sfxCoin, sfxStreak, sfxComplete, sfxTick)
- **Mastery**: Per-card tracking (0–3), correct increments, wrong resets to 0. Stars shown on end screen.
- **Speed bonus**: Time remaining ratio × 5 extra points on correct answer

## Data Format (from TA, unchanged)

```json
{ "sub_type": "SentenceCompletion", "cards": [{ "id": 1, "sentence_template": "The ____ is red.", "missing_word": "apple", "options": ["apple","car","dog"] }] }
```

## Events

gameStarted, correctAnswer, incorrectAnswer, matchFound, matchMiss, gameCompleted

## Actions

Player: submit(value), next
Teacher: reveal, jump(to), end, set(field, value)
