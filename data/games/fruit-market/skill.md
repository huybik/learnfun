---
id: fruit-market
name: Fruit Market
tags: [vocabulary, fruits, english, visual, interactive, sorting, shopping, math]
maxPlayers: 4
---

# Fruit Market

Full-screen interactive fruit market game with 4 phases: learn, quiz, sort, and shop. Students explore a colorful market stall, identify fruits, sort them into categories, and buy them with coins. Features animations, sound effects, streaks, and particles.

Available fruits (built-in SVG assets): apple, banana, orange, strawberry, grape, watermelon, pineapple, mango, cherry, lemon, peach, pear, kiwi, coconut, blueberry, avocado.

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON. All four sections are optional — include whichever are appropriate for the lesson.

### Phases & Waves

The game interleaves learn and play in waves of 4: **learn 4 → quiz 4 → learn 4 → quiz 4 → ... → sort → shop**. Align intros and challenges so that intro[0..3] match challenges[0..3], etc.

1. **Learn** (`intro`) — Teacher introduces fruits one by one with fun facts (4 per wave)
2. **Play** (`challenges`) — Quiz: pick the correct fruit from a grid (4 per wave)
3. **Sort** (`sort`) — Categorize fruits into labeled bins
4. **Shop** (`shop`) — Buy fruits at the market with a coin budget

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
      "pool": ["apple", "cherry", "strawberry", "peach", "pear", "orange"]
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
- **Intro**: Include `intro` items for each fruit that appears as a target in challenges. Each has `fruit` (required), `title`, and `fact`. Group in batches of 4 matching the challenge order
- **Challenges**: 8 challenges (2 waves of 4), each with `pool` of 4-8 fruits (one is the target). Hints should be fun with emojis. Vary pool sizes for difficulty. Include similar distractors. Align with intro order so wave 1 intros match wave 1 challenges
- **Sort**: 1-2 rounds. Each round has `fruits` (6-8 to sort) and `categories` (2-3 bins). Every fruit in `fruits` must belong to exactly one category. Categories should be intuitive (color, taste, tropical/non-tropical, size, etc.)
- **Shop**: `budget` is total coins. `items` are 4-8 fruits with prices (10-30 range). `goal` is a fun shopping mission. Budget should allow buying 3-5 items but not everything
- All sections are optional — use what fits the lesson

## Actions (universal)

### Player
- submit(value: string) — click/submit a fruit name
- next() — advance to the next challenge

### Teacher
- submit(value: string) — same as player (in sort: auto-sorts to correct bin; in shop: buys the fruit)
- next() — same as player
- reveal() — reveal the answer (play: highlights correct fruit; sort: highlights correct bin and auto-sorts)
- jump(to: number) — jump to a specific challenge/sort-round by index
- end() — end the game immediately
- set(field: string, value: unknown) — override a game field (e.g. field="score", value=50; field="phase", value="sort")

## State

Learn phase:
```json
{ "phase": "learn", "introIndex": 0, "introTotal": 8, "currentFruit": "apple", "wave": 0 }
```

Play phase:
```json
{ "phase": "play", "challengeIndex": 0, "score": 10, "total": 8, "streak": 3, "answered": false, "isComplete": false, "currentFruit": "apple", "wave": 0 }
```

Sort phase:
```json
{ "phase": "sort", "sortRound": 0, "sortTotal": 1, "remaining": 4, "score": 70 }
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
- correctSort(fruit, category, score) — fruit sorted into correct bin
- incorrectSort(fruit, category) — fruit sorted into wrong bin
- sortRoundComplete(round, score) — all fruits sorted in a round
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
- Reference what they learned in the intro

### Sort Phase
- Explain the bins: "Now let's organize! Can you sort these by color?"
- When a fruit is selected, give a hint about which bin: "Hmm, what color is a cherry?"
- Celebrate correct sorts enthusiastically
- On incorrectSort, gently redirect: "Not quite! Think about the color..."
- Use reveal() if student is stuck — it highlights the correct bin

### Shop Phase
- Adopt a shopkeeper persona: "Welcome to my fruit shop!"
- Comment on purchases: "Great choice! Mangoes are delicious!"
- Help with math: "You have 55 coins left, can you afford the coconut?"
- Encourage strategic buying: "Think about what goes well in a smoothie!"
- Praise the final basket: "What a wonderful selection!"

### End
- Praise the final score enthusiastically
- Reference highlights from all phases
- Celebrate the basket if shop phase was played
