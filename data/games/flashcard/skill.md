---
id: flashcard
name: Flashcard Challenge
tags: [vocabulary, flashcards, english, sentences]
maxPlayers: 4
---

# Flashcard Challenge

Multi-phase flashcard game: learn → quiz → speed round → memory match → stats. Two modes: ImageToWord (show image, type word), SentenceCompletion (fill in the blank).

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

## Phases

1. **Learn** — Preview cards with answers visible, no scoring
2. **Quiz** — Multiple choice/text input, +10 pts, streak tracking
3. **Speed** — 8s timer per card, time bonus up to +5 pts
4. **Match** — Memory pairs (term ↔ answer), up to 4 pairs, +10 pts
5. **End** — Score, accuracy, best streak, mastery stars

## State

Key fields: phase (learn/quiz/speed/match/end), cardIndex, score, total, streak, answered, currentAnswer, bestStreak, totalCorrect, totalAnswered, mastery (card id → 0-3 stars).

## Events

gameStarted, correctAnswer, incorrectAnswer, matchFound, matchMiss, gameCompleted

## Teacher Guide

- Learn: let student absorb, comment on facts
- Quiz: encourage per card, react to streaks, reveal() if stuck (3+ wrong auto-reveals)
- Speed: build excitement, cheer fast answers
- Match: react to matchFound/matchMiss
- Use jump(to) to skip, end() for breaks
