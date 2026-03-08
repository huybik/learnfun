---
id: flashcard
name: Flashcard Challenge
tags: [vocabulary, flashcards, english, sentences]
maxPlayers: 4
---

# Flashcard Challenge

Multi-mode flashcard game with 2 sub-types: ImageToWord (show image, type word), SentenceCompletion (fill in the blank).

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

Create 5-10 items at the student's level.

## Actions

### Player
- submitAnswer(answer: string) — submit an answer for the current card
- nextCard() — advance to the next card

### Teacher
- submitAnswer(answer: string) — same as player
- nextCard() — same as player
- revealAnswer() — reveal the answer without scoring
- setScore(score: number) — override the current score
- setCardIndex(index: number) — jump to a specific card
- skipToEnd() — end the game immediately

## State
```json
{ "mode": "SentenceCompletion", "cardIndex": 0, "score": 10, "total": 5, "answered": false, "isComplete": false, "currentAnswer": "apple" }
```

## Events
- gameStarted(mode, total)
- correctAnswer(cardIndex, expected, given, score)
- incorrectAnswer(cardIndex, expected, given, score)
- gameCompleted(score, total)

## Teacher Guide

- Start by asking what topic the student wants to practice
- Encourage after each card ("Great job!", "Almost!")
- React to correctAnswer/incorrectAnswer events
- Use revealAnswer if student is stuck for too long
- Use setCardIndex to skip to harder cards if student is doing well
- Switch sub-types between rounds to keep engagement high
