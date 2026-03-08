---
id: fruit-market
name: Fruit Market
tags: [vocabulary, fruits, english, visual, interactive, sorting, shopping, math, memory, patterns]
maxPlayers: 4
---

# Fruit Market

Full-screen interactive fruit market game with 8 phases: learn, quiz, memory, odd-one-out, pattern, sort, recipe, and shop. Students explore a colorful market stall, identify fruits, match pairs, spot odd ones out, complete patterns, sort into categories, follow recipes, and buy with coins. Features drag-and-drop, animations, sound effects, streaks, timer mode, and particles.

Available fruits (built-in SVG assets): apple, banana, orange, strawberry, grape, watermelon, pineapple, mango, cherry, lemon, peach, pear, kiwi, coconut, blueberry, avocado.

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON. All sections are optional — include whichever are appropriate for the lesson.

### Phases & Waves

The game interleaves learn and play in waves of 4: **learn 4 → quiz 4 → learn 4 → quiz 4 → ... → memory → oddoneout → pattern → sort → recipe → shop**. Align intros and challenges so that intro[0..3] match challenges[0..3], etc.

1. **Learn** (`intro`) — Teacher introduces fruits one by one with fun facts (4 per wave)
2. **Play** (`challenges`) — Quiz: pick the correct fruit from a grid (4 per wave). Supports modes: `find` (default), `shadow` (silhouette only), `describe` (no labels)
3. **Memory** (`memory`) — Flip cards to find matching pairs
4. **Odd One Out** (`oddoneout`) — Pick the fruit that doesn't belong to a group
5. **Pattern** (`pattern`) — Complete a fruit sequence
6. **Sort** (`sort`) — Categorize fruits into labeled bins (tap or drag)
7. **Recipe** (`recipes`) — Buy specific required fruits to complete a recipe
8. **Shop** (`shop`) — Buy fruits at the market with a coin budget (tap or drag to basket)

### Optional settings

- `"timed": true` — adds a countdown timer to quiz challenges. Faster answers earn bonus points
- `"timerDuration": 8000` — timer length in ms (default 10000)

```json
{
  "intro": [
    { "fruit": "apple", "title": "Meet the Apple!", "fact": "Apples are crunchy and come in red, green, and yellow!" }
  ],
  "challenges": [
    {
      "id": 1,
      "fruit": "apple",
      "hint": "Find the crunchy red fruit that keeps the doctor away!",
      "pool": ["apple", "cherry", "strawberry", "peach", "pear", "orange"],
      "mode": "find"
    }
  ],
  "memory": [
    { "fruits": ["apple", "banana", "grape", "cherry"] }
  ],
  "oddoneout": [
    {
      "fruits": ["apple", "cherry", "strawberry", "banana"],
      "odd": "banana",
      "trait": "red fruit",
      "explanation": "Banana is yellow — the rest are red!"
    }
  ],
  "pattern": [
    {
      "sequence": ["apple", "banana", "apple", "banana"],
      "answer": "apple",
      "options": ["apple", "grape", "banana", "cherry"]
    }
  ],
  "sort": [
    {
      "fruits": ["apple", "cherry", "banana", "lemon", "grape", "blueberry"],
      "categories": [
        { "name": "Red Fruits", "emoji": "🔴", "fruits": ["apple", "cherry"] },
        { "name": "Yellow Fruits", "emoji": "🟡", "fruits": ["banana", "lemon"] },
        { "name": "Blue & Purple", "emoji": "🟣", "fruits": ["grape", "blueberry"] }
      ]
    }
  ],
  "recipes": [
    {
      "name": "Tropical Smoothie",
      "emoji": "🥤",
      "required": ["mango", "pineapple", "banana"],
      "budget": 80,
      "available": [
        { "fruit": "mango", "price": 20 },
        { "fruit": "pineapple", "price": 18 },
        { "fruit": "banana", "price": 10 },
        { "fruit": "apple", "price": 12 },
        { "fruit": "grape", "price": 8 }
      ]
    }
  ],
  "shop": {
    "budget": 100,
    "goal": "Buy fruits for a smoothie! 🥤",
    "items": [
      { "fruit": "strawberry", "price": 15 },
      { "fruit": "banana", "price": 10 },
      { "fruit": "mango", "price": 20 }
    ]
  }
}
```

### Rules

- Use only the 16 available fruit names listed above
- **Intro**: `fruit` (required), `title`, `fact`. Group in batches of 4 matching the challenge order
- **Challenges**: 8 challenges (2 waves of 4), each with `pool` of 4-8 fruits. Optional `mode`: `find` (default), `shadow` (silhouettes — identify by shape), `describe` (no labels shown). Vary modes across challenges for variety
- **Memory**: 1-2 rounds. Each round has `fruits` (3-6 unique fruits, each becomes a pair). More fruits = harder
- **Odd One Out**: 2-4 rounds. Each has 4 `fruits`, one `odd`, a `trait` describing the group, and optional `explanation`. Traits: color, size, tropical, taste, shape
- **Pattern**: 2-4 rounds. Each has a `sequence` (4-6 fruits showing the pattern), `answer` (next fruit), `options` (3-4 choices including the answer). Start simple (ABAB), get harder (ABCABC, AABBAABB)
- **Sort**: 1-2 rounds. Each round has `fruits` (6-8) and `categories` (2-3 bins). Every fruit must belong to exactly one category
- **Recipe**: 1-2 recipes. Each has `name`, `emoji`, `required` (3-4 must-have fruits), `budget`, `available` (5-7 items with prices including required + decoys). Budget should be tight enough to force choices
- **Shop**: `budget`, `items` (4-8 fruits with prices 10-30), `goal`. Budget allows 3-5 items but not all
- All sections are optional — use what fits the lesson
- For variety, mix challenge modes: use `shadow` for 1-2 challenges and `describe` for 1-2

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
{ "phase": "learn", "introIndex": 0, "introTotal": 8, "currentFruit": "apple", "wave": 0 }
```

Play phase:
```json
{ "phase": "play", "challengeIndex": 0, "score": 10, "total": 8, "streak": 3, "answered": false, "isComplete": false, "currentFruit": "apple", "wave": 0 }
```

Memory phase:
```json
{ "phase": "memory", "round": 0, "total": 1, "matched": 2, "pairs": 4, "score": 90 }
```

Odd One Out phase:
```json
{ "phase": "oddoneout", "round": 0, "total": 2, "trait": "red fruit", "answered": false, "score": 90 }
```

Pattern phase:
```json
{ "phase": "pattern", "round": 0, "total": 2, "answered": false, "score": 100 }
```

Sort phase:
```json
{ "phase": "sort", "sortRound": 0, "sortTotal": 1, "remaining": 4, "score": 70 }
```

Recipe phase:
```json
{ "phase": "recipe", "recipe": "Tropical Smoothie", "round": 0, "total": 1, "budget": 50, "basket": ["mango"], "remaining": 2, "score": 100 }
```

Shop phase:
```json
{ "phase": "shop", "budget": 55, "basketSize": 3, "basket": ["strawberry", "banana", "mango"], "score": 85 }
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
- recipeBuy(fruit, price, budget, required) — fruit bought for recipe
- itemBought(fruit, price, budget, basket) — fruit purchased in shop
- gameCompleted(score, total)

## Teacher Guide

### Learn Phase
- Introduce each fruit with enthusiasm: "Look at this beautiful apple!"
- Share the fun fact shown on screen, then add your own details
- Ask the student questions: "Have you ever tried this fruit? What color is it?"
- Call `next()` to advance when the student has learned enough
- Don't rush — let the student absorb each fruit

### Play Phase
- Use a fun market vendor persona ("Now let's see what you remember!")
- Read the hint aloud with enthusiasm before the student clicks
- React to correctAnswer events ("Amazing! You really know your fruits!")
- On incorrectAnswer, give an extra verbal hint ("Hmm, look for something rounder...")
- Use reveal() if student is stuck after ~15 seconds
- Celebrate streaks ("Wow, 3 in a row! You're on fire!")
- For shadow mode: "Can you tell which fruit this is just by its shape?"
- For describe mode: "Listen to the clue — no names to help you!"

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
- The explanation shows automatically — read it aloud

### Pattern Phase
- Explain: "Look at the pattern — what comes next?"
- Trace the pattern aloud: "Apple, banana, apple, banana... so next is?"
- On correct: "You cracked the code!"
- Start simple (ABAB), build excitement for harder ones

### Sort Phase
- Explain the bins: "Now let's organize! Can you sort these by color?"
- Students can tap OR drag fruits to bins
- When a fruit is selected, give a hint about which bin
- Celebrate correct sorts enthusiastically
- On incorrectSort, gently redirect
- Use reveal() if student is stuck

### Recipe Phase
- Adopt a chef persona: "Time to make a Tropical Smoothie!"
- Point out which ingredients are needed (they glow)
- Help with budget: "You need mango and pineapple — can you afford both?"
- Celebrate when recipe is complete: "Perfect! All ingredients collected!"

### Shop Phase
- Adopt a shopkeeper persona: "Welcome to my fruit shop!"
- Students can tap OR drag fruits into the basket
- Comment on purchases and help with math
- Praise the final basket

### End
- Praise the final score enthusiastically
- Reference highlights from all phases
- Celebrate the basket if shop/recipe phases were played
