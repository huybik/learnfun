---
id: fruit-market
name: Fruit Market
tags: [vocabulary, fruits, english, visual]
maxPlayers: 4
---

# Fruit Market

Interactive fruit identification game with 2 modes: Identify (show fruit, pick name) and Basket (show grid, find the described fruit).

Available fruits: apple, banana, orange, strawberry, grape, watermelon, pineapple, mango, cherry, lemon, peach, pear, kiwi, coconut, blueberry, avocado.

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON with `mode` and `challenges` array.

**Identify** — show a fruit image, student picks the name:
```json
{ "mode": "identify", "challenges": [{ "id": 1, "fruit": "apple", "hint": "This red fruit keeps the doctor away", "options": ["apple", "cherry", "strawberry", "peach"] }] }
```

**Basket** — show a grid of fruits, student clicks the one matching the description:
```json
{ "mode": "basket", "challenges": [{ "id": 1, "fruit": "banana", "hint": "Yellow and curved, monkeys love it", "pool": ["banana", "apple", "grape", "orange", "kiwi", "mango", "pear", "lemon"] }] }
```

Rules for generation:
- Use only the 16 available fruit names listed above
- Create 5-8 challenges per game
- For identify mode: provide 4 options per challenge, one correct
- For basket mode: provide 8 fruits in pool, one correct
- Hints should be fun, age-appropriate descriptions
- Vary difficulty based on student level

## Actions (universal)

### Player
- submit(value: string) — submit a fruit name
- next() — advance to the next challenge

### Teacher
- submit(value: string) — same as player
- next() — same as player
- reveal() — reveal the answer without scoring
- jump(to: number) — jump to a specific challenge by index
- end() — end the game immediately
- set(field: string, value: unknown) — override a game field (e.g. field="score", value=50)

## State
```json
{ "mode": "identify", "challengeIndex": 0, "score": 10, "total": 5, "answered": false, "isComplete": false, "currentFruit": "apple" }
```

## Events
- gameStarted(mode, total)
- correctAnswer(challengeIndex, expected, given, score)
- incorrectAnswer(challengeIndex, expected, given, score)
- gameCompleted(score, total)

## Teacher Guide

- Start by asking the student about their favorite fruits
- Use enthusiastic, market-vendor persona ("Welcome to my fruit stand!")
- Encourage after each challenge ("Great eye!", "You know your fruits!")
- React to correctAnswer/incorrectAnswer events with personality
- Use reveal() if student is stuck for too long
- Switch between identify and basket modes between rounds for variety
- For younger students, give extra hints verbally before they answer
- Celebrate the final score enthusiastically
