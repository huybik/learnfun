---
id: flashcard
name: Flashcard Challenge
tags: [vocabulary, flashcards, english, sentences]
maxPlayers: 4
---

# Flashcard Challenge

Multi-phase flashcard game: learn → quiz → speed round → memory match → stats. Two content modes: ImageToWord (show image, type word), SentenceCompletion (fill in the blank).

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON with `sub_type` and content array.

**ImageToWord** — show an image, student types the word:
```json
{ "sub_type": "ImageToWord", "cards": [{ "id": 1, "image_data": "<base64>", "answer": "cat" }] }
```

**SentenceCompletion** — fill in the blank:
```json
{ "sub_type": "SentenceCompletion", "cards": [{ "id": 1, "sentence_template": "The ____ is red.", "missing_word": "apple", "options": ["apple", "car", "dog"] }] }
```

Create 5-10 items at the student's level. Use `____` (4+ underscores) for blanks.

## Game Phases

1. **Learn** — Preview all cards with answers visible (no scoring). Student clicks to advance.
2. **Quiz** — Standard Q&A. Multiple choice or text input. Streak tracking, particles, +10 pts per correct.
3. **Speed Round** — Same cards reshuffled, 8s countdown timer per card. Time bonus up to +5 pts.
4. **Memory Match** — Flip pairs: match sentence/image to answer. Up to 4 pairs. +10 pts per match.
5. **End** — Score, accuracy, best streak, mastery stars per card.

## Actions (universal)

### Player
- submit(value: string) — submit an answer for the current card
- next() — advance to the next card

### Teacher
- submit(value: string) — same as player
- next() — same as player
- reveal() — reveal the answer without scoring
- jump(to: number) — jump to a specific card by index
- end() — end the game immediately
- set(field: string, value: unknown) — override a game field (e.g. field="score", value=50)

## State Updates
```json
{ "phase": "quiz", "mode": "SentenceCompletion", "cardIndex": 0, "score": 10, "total": 5, "streak": 2, "answered": false, "isComplete": false, "currentAnswer": "apple", "bestStreak": 3, "totalCorrect": 4, "totalAnswered": 5, "mastery": {"1": 2, "2": 1} }
```

Key fields: `phase` (learn/quiz/speed/match/end), `streak` (current), `mastery` (card id → consecutive correct 0-3).

## Events
- gameStarted(mode, total)
- correctAnswer(cardIndex, expected, given, score)
- incorrectAnswer(cardIndex, expected, given, score)
- matchFound(pairId, score)
- matchMiss()
- gameCompleted(score, total)

## Teacher Guide

- Start by asking what topic the student wants to practice
- During **learn** phase: let student absorb at their pace, comment on interesting facts
- During **quiz**: encourage after each card ("Great job!", "Almost!"). React to streak events.
- Use reveal() if student is stuck for too long (3+ wrong attempts auto-reveals)
- During **speed round**: build excitement, cheer fast answers
- During **match**: react to matchFound/matchMiss events
- Use jump(to) to skip cards if student is doing well
- Use end() if student needs a break
