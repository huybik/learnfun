---
id: fruit-market
name: Fruit Market
tags: [vocabulary, fruits, english, visual, interactive, sorting, shopping, math, memory, patterns]
maxPlayers: 4
selfContained: true
---

# Fruit Market

Full-screen interactive fruit market game with a learn-play-earn-shop loop across 3 waves. Students learn 3 fruits per wave, earn coins through mini-games, and spend coins at the shop to choose which fruits to learn next.

Available fruits (built-in SVG assets): apple, banana, orange, strawberry, grape, watermelon, pineapple, mango, cherry, lemon, peach, pear, kiwi, coconut, blueberry, avocado.

## Game Flow

Each wave follows this cycle:

```
Wave 1: Learn 3 (free starter: apple, banana, orange)
         → Quiz 3
         → 2 mini-games (earn coins)
         → Shop (spend coins, pick 3 new fruits)

Wave 2: Learn 3 (fruits they bought)
         → Quiz 3
         → 2 mini-games (earn coins)
         → Shop (spend coins, pick 3 more)

Wave 3: Learn 3 (fruits they bought)
         → Quiz 3
         → 2 mini-games (earn coins)
         → End (show final score)
```

**Key mechanic:** Kids choose what they learn next by buying fruits at the shop. Mini-games earn coins to spend in the shop. Score = total coins earned (never decreases).

**Mini-games** (2 per wave, shuffled): memory, pattern, odd-one-out, sort, juice drink. Games requiring more fruits (sort, odd-one-out) appear in later waves.

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON. Provide title, fact, and hint for each fruit.

```json
{
  "fruits": {
    "apple": {
      "title": "Meet the Apple!",
      "fact": "Apples are crunchy and come in red, green, and yellow!",
      "hint": "Find the crunchy red fruit that keeps the doctor away!"
    },
    "banana": {
      "title": "Meet the Banana!",
      "fact": "Bananas are curved, yellow, and full of energy!",
      "hint": "Find the yellow curved fruit that monkeys love!"
    }
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

## Actions (universal)

### Player
- submit(value: string) — click/submit a fruit name
- next() — advance to the next challenge

### Teacher
- submit(value: string) — same as player (works in all phases)
- next() — same as player
- reveal() — reveal the answer (play: highlights correct; sort: highlights bin; oddoneout/pattern: shows answer)
- jump(to: number) — jump to a specific challenge/round by index
- end() — end the game immediately
- set(field: string, value: unknown) — override a game field (e.g. field="score", value=50; field="phase", value="memory")

## State

Learn phase:
```json
{ "phase": "learn", "introIndex": 0, "introTotal": 3, "currentFruit": "apple", "wave": 0, "coins": 0, "score": 0, "learnedFruits": [] }
```

Play phase:
```json
{ "phase": "play", "challengeIndex": 0, "total": 3, "streak": 2, "answered": false, "currentFruit": "apple", "wave": 0, "coins": 30, "score": 30 }
```

Memory phase:
```json
{ "phase": "memory", "round": 0, "total": 1, "matched": 2, "pairs": 4, "wave": 0, "coins": 50, "score": 50 }
```

Odd One Out phase:
```json
{ "phase": "oddoneout", "round": 0, "total": 1, "trait": "red fruit", "answered": false, "wave": 1, "coins": 70, "score": 70 }
```

Pattern phase:
```json
{ "phase": "pattern", "round": 0, "total": 1, "answered": false, "wave": 0, "coins": 40, "score": 40 }
```

Sort phase:
```json
{ "phase": "sort", "sortRound": 0, "sortTotal": 1, "remaining": 4, "wave": 1, "coins": 80, "score": 80 }
```

Shop phase:
```json
{ "phase": "shop", "budget": 60, "basketSize": 1, "basket": ["mango"], "wave": 0, "coins": 60, "score": 90 }
```

Juice phase:
```json
{ "phase": "juice", "recipe": "Berry Blast", "basket": ["strawberry"], "remaining": 2, "wave": 2, "coins": 100, "score": 100 }
```

## Events
- gameStarted(total, phase)
- introAdvance(index, fruit) — advancing through learn phase
- phaseChange(phase) — transitioning between phases
- correctAnswer(challengeIndex, expected, given, score)
- incorrectAnswer(challengeIndex, expected, given, score)
- memoryMatch(fruit, matched, total, score) — pair found in memory
- memoryMiss(fruit1, fruit2) — mismatched pair
- memoryRoundComplete(round, score)
- oddCorrect(round, odd, score) — correct odd-one-out pick
- oddWrong(round, picked, odd) — wrong pick
- patternCorrect(round, answer, score) — correct pattern answer
- patternWrong(round, picked, answer) — wrong pick
- correctSort(fruit, category, score) — fruit sorted into correct bin
- incorrectSort(fruit, category) — fruit sorted into wrong bin
- sortRoundComplete(round, score)
- juiceCorrect(fruit, recipe, score) — correct fruit for juice recipe
- juiceWrong(fruit, recipe) — wrong fruit for juice
- itemBought(fruit, price, budget, basket) — fruit purchased in shop
- gameCompleted(score, coins, learnedFruits)

## Teacher Guide

### Learn Phase
- Introduce each fruit with enthusiasm: "Look at this beautiful apple!"
- Share the fun fact shown on screen, then add your own details
- Ask the student questions: "Have you ever tried this fruit? What color is it?"
- Call `next()` to advance when the student has learned enough
- Don't rush — let the student absorb each fruit

### Play Phase (Quiz)
- Use a fun market vendor persona ("Now let's see what you remember!")
- Read the hint aloud with enthusiasm before the student clicks
- React to correctAnswer events ("Amazing! You really know your fruits!")
- On incorrectAnswer, give an extra verbal hint ("Hmm, look for something rounder...")
- Use reveal() if student is stuck after ~15 seconds
- Celebrate streaks ("Wow, 3 in a row! You're on fire!")

### Memory Phase
- Explain the game: "Let's test your memory! Find the matching pairs!"
- Encourage the student: "Try to remember where you saw that fruit!"
- Celebrate matches: "Great memory! You found both cherries!"
- On mismatches, be supportive: "Not a match, but now you know where they are!"

### Odd One Out Phase
- Read the trait: "Which one is NOT a red fruit?"
- Give thinking time before hints
- On correct: celebrate the reasoning: "Yes! Banana is yellow, not red!"
- On wrong: gently explain: "Actually, look at the colors more carefully..."

### Pattern Phase
- Explain: "Look at the pattern — what comes next?"
- Trace the pattern aloud: "Apple, banana, apple, banana... so next is?"
- On correct: "You cracked the code!"

### Sort Phase
- Explain the bins: "Now let's organize! Can you sort these by color?"
- Students can tap OR drag fruits to bins
- Celebrate correct sorts enthusiastically
- On incorrectSort, gently redirect

### Juice Phase
- Adopt a chef persona: "Time to make a Berry Blast!"
- Point out the ingredients needed (shown at the top)
- Celebrate when the drink is complete: "Delicious! Great mixing!"

### Shop Phase
- Build excitement: "Now YOU get to choose what to learn next!"
- Comment on their choices: "Ooh, pineapple — great choice!"
- Encourage exploration: "Pick something you've always wanted to know about!"

### End
- Praise the final score enthusiastically
- Reference highlights: how many fruits learned, best streaks
- Encourage them to come back and learn different fruits next time
