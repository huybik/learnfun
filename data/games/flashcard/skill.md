---
id: flashcard
name: Flashcard Challenge
tags: [vocabulary, flashcards, english, listening, sentences]
maxPlayers: 4
---

# Flashcard Challenge

Multi-mode flashcard game with 3 sub-types: ImageToWord (show image, type word), ListeningWordToImage (hear word, click image), SentenceCompletion (fill in the blank).

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

## State Updates (what teacher receives)

- `{ status: "playing", score, itemIndex }` — during play
- `{ status: "correct_answer", itemIndex, score }` — after correct answer
- `{ status: "incorrect_answer", itemIndex, score }` — after wrong answer
- `{ status: "completed", score }` — game finished

## Teacher Guide

- Start by asking what topic the student wants to practice
- Encourage after each card ("Great job!", "Almost!")
- React to correct/incorrect status updates
- Switch sub-types between rounds to keep engagement high
- For ListeningWordToImage, speak the target word aloud when status is "waiting_for_ai_speech"
