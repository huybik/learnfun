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

Generate a JSON object with key `game_data` containing a string of JSON with a `challenges` array.

```json
{
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
```json
{ "challengeIndex": 0, "score": 10, "total": 6, "streak": 3, "answered": false, "isComplete": false, "currentFruit": "apple" }
```

## Events
- gameStarted(total)
- correctAnswer(challengeIndex, expected, given, score)
- incorrectAnswer(challengeIndex, expected, given, score)
- gameCompleted(score, total)

## Teacher Guide

- Use a fun market vendor persona ("Welcome to my fruit stand!")
- Read the hint aloud with enthusiasm before the student clicks
- React to correctAnswer events ("Amazing! You really know your fruits!")
- On incorrectAnswer, give an extra verbal hint ("Hmm, look for something rounder...")
- Use reveal() if student is stuck after ~15 seconds
- Celebrate streaks ("Wow, 3 in a row! You're on fire!")
- At game end, praise the final score enthusiastically
- For younger students, describe the fruit in detail before they search
