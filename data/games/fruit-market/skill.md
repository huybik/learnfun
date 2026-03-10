---
id: fruit-market
name: Fruit Market
tags: [vocabulary, fruits, english, visual, interactive, sorting, shopping, math, memory, patterns]
maxPlayers: 4
selfContained: true
---

# Fruit Market

Interactive fruit market: learn-play-earn-shop loop across 3 waves. 16 built-in SVG fruits: apple, banana, orange, strawberry, grape, watermelon, pineapple, mango, cherry, lemon, peach, pear, kiwi, coconut, blueberry, avocado.

## Game Flow

Wave cycle (×3): Learn 3 fruits → Quiz 3 → 2 mini-games (earn coins) → Shop (buy 3 new fruits).
Wave 1 starters: apple, banana, orange. Mini-games: memory, pattern, odd-one-out, sort, juice.
Score = total coins earned. Kids choose what to learn next by buying at the shop.

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON. Provide title, fact, and hint for each fruit.

```json
{
  "fruits": {
    "apple": { "title": "Meet the Apple!", "fact": "Apples are crunchy and come in red, green, and yellow!", "hint": "Find the crunchy red fruit that keeps the doctor away!" },
    "banana": { "title": "Meet the Banana!", "fact": "Bananas are curved, yellow, and full of energy!", "hint": "Find the yellow curved fruit that monkeys love!" }
  },
  "starterFruits": ["apple", "banana", "orange"],
  "fruitPrice": 10
}
```

### Rules

- Use only the 16 available fruit names listed above
- **fruits**: Object with data for all 16 fruits. Each has `title` (fun greeting), `fact` (one fun fact for kids), `hint` (clue for the quiz challenge)
- **starterFruits** (optional): First 3 fruits to learn for free. Default: apple, banana, orange
- **fruitPrice** (optional): Coin cost per fruit in shop. Default: 10
- **timed** (optional): `true` to add countdown timer to quiz challenges
- **timerDuration** (optional): Timer length in ms (default 10000)
- Challenge pools are generated dynamically — no need to specify
- Mini-game data (memory, pattern, sort, odd-one-out, juice) is generated dynamically from learned fruits — no need to specify
- Make each fruit's fact unique and fun — kids will see these during the learn phase
- Hints should be descriptive enough to identify the fruit from a grid of 6

## State

Key fields: phase (learn/play/memory/oddoneout/pattern/sort/juice/shop/end), wave (0-2), coins, score, currentFruit, streak, answered, learnedFruits, budget (shop), basket (shop).

## Events

gameStarted, introAdvance, phaseChange, correctAnswer, incorrectAnswer, memoryMatch, memoryMiss, memoryRoundComplete, oddCorrect, oddWrong, patternCorrect, patternWrong, correctSort, incorrectSort, sortRoundComplete, juiceCorrect, juiceWrong, itemBought, gameCompleted

## Teacher Guide

- Learn: introduce fruits enthusiastically, share facts, ask questions, next() when ready
- Quiz: vendor persona, read hints, celebrate streaks, reveal() if stuck ~15s
- Mini-games (memory/pattern/sort/oddoneout): explain rules, encourage, celebrate, gentle on mistakes
- Juice: chef persona, point out ingredients
- Shop: build excitement about choosing
- End: praise score, reference highlights
