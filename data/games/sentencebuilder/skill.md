---
id: sentencebuilder
name: Sentence Builder
tags: [grammar, sentences, english, word-order]
maxPlayers: 4
---

# Sentence Builder

Word-ordering game where students drag words from a bank to construct the correct sentence. Supports distractor words for added challenge.

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON:

```json
{
  "words": ["the", "cat", "sat", "on", "mat"],
  "correctSentence": "the cat sat on mat",
  "prompt": "Put these words in order",
  "distractors": ["ran", "big"]
}
```

- `words` (required): array of words to arrange
- `correctSentence` (required): the target sentence
- `prompt` (optional): instruction for the student
- `distractors` (optional): extra wrong words for added difficulty

Adjust complexity for the student's level. Beginners: 3-5 words, no distractors. Advanced: 6-8 words with 2-3 distractors.

## State Updates (what teacher receives)

- `{ status: "playing", wordsInBank, targetLength }` — game started
- `{ status: "incorrect_attempt", submittedSentence }` — wrong order
- `{ status: "correct", finalSentence }` — correct sentence built

## Teacher Guide

- If the student submits an incorrect attempt, give a gentle hint without revealing the answer
- Celebrate correct completion enthusiastically
- For advanced students, ask them to explain why that word order is correct
