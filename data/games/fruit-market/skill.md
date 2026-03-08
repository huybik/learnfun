---
id: fruit-market
name: Fruit Market
tags: [vocabulary, fruits, english, visual, interactive]
maxPlayers: 4
---

# Fruit Market

Full-screen interactive fruit identification game. Students see a colorful market stall with fruits displayed on cards. The teacher gives hints/descriptions and students click the matching fruit. Features animations, sound effects, streaks, and particles.

Available fruits (built-in SVG assets): apple, banana, orange, strawberry, grape, watermelon, pineapple, mango, cherry, lemon, peach, pear, kiwi, coconut, blueberry, avocado.

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON with an optional `intro` array and a `challenges` array.

The game has two phases:
1. **Learn phase** (optional) — Teacher introduces each fruit one by one with fun facts. The teacher talks about each fruit while the student sees a big illustration. Teacher calls `next()` to advance.
2. **Play phase** — Quiz where students pick the correct fruit from a grid.

If `intro` is provided, the game starts in learn phase and auto-transitions to play after all intros.

```json
{
  "intro": [
    { "fruit": "apple", "title": "Meet the Apple!", "fact": "Apples are crunchy and come in red, green, and yellow!" },
    { "fruit": "banana", "title": "Meet the Banana!", "fact": "Bananas are curved, yellow, and full of energy!" }
  ],
  "challenges": [
    {
      "id": 1,
      "fruit": "apple",
      "hint": "Find the crunchy red fruit that keeps the doctor away!",
      "pool": ["apple", "cherry", "strawberry", "peach", "pear", "orange"]
    }
  ]
}
```

Rules:
- Use only the 16 available fruit names listed above
- Include `intro` items for each fruit that appears as a target in challenges
- Each intro has `fruit` (required), `title`, and `fact` (fun age-appropriate fact)
- Create 5-8 challenges
- Each challenge has a `pool` of 4-8 fruits (one is the target `fruit`)
- Hints should be fun, descriptive, and age-appropriate — use emojis!
- Vary pool size for difficulty: 4 fruits = easy, 8 = harder
- Include distractors that look similar to the target (e.g. cherry with strawberry)
- Avoid repeating the same pool composition

## Actions (universal)

### Player
- submit(value: string) — click/submit a fruit name
- next() — advance to the next challenge

### Teacher
- submit(value: string) — same as player
- next() — same as player
- reveal() — reveal the answer (highlights correct fruit)
- jump(to: number) — jump to a specific challenge by index
- end() — end the game immediately
- set(field: string, value: unknown) — override a game field (e.g. field="score", value=50)

## State

Learn phase:
```json
{ "phase": "learn", "introIndex": 0, "introTotal": 3, "currentFruit": "apple" }
```

Play phase:
```json
{ "phase": "play", "challengeIndex": 0, "score": 10, "total": 6, "streak": 3, "answered": false, "isComplete": false, "currentFruit": "apple" }
```

## Events
- gameStarted(total, phase)
- introAdvance(index, fruit) — fired when advancing through learn phase
- phaseChange(phase) — fired when transitioning from learn to play
- correctAnswer(challengeIndex, expected, given, score)
- incorrectAnswer(challengeIndex, expected, given, score)
- gameCompleted(score, total)

## Teacher Guide

### Learn Phase
- Introduce each fruit with enthusiasm: "Look at this beautiful apple!"
- Share the fun fact shown on screen, then add your own details
- Ask the student questions: "Have you ever tried this fruit? What color is it?"
- Call `next()` to advance when you feel the student has learned enough about the current fruit
- Don't rush — let the student absorb each fruit before moving on

### Play Phase
- Use a fun market vendor persona ("Now let's see what you remember!")
- Read the hint aloud with enthusiasm before the student clicks
- React to correctAnswer events ("Amazing! You really know your fruits!")
- On incorrectAnswer, give an extra verbal hint ("Hmm, look for something rounder...")
- Use reveal() if student is stuck after ~15 seconds
- Celebrate streaks ("Wow, 3 in a row! You're on fire!")
- At game end, praise the final score enthusiastically
- Reference what they learned in the intro: "Remember when we talked about this one?"
