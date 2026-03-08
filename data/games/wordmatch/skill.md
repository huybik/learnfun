---
id: wordmatch
name: Crystal Word Match
tags: [vocabulary, matching, english, 3d]
maxPlayers: 4
---

# Crystal Word Match

3D crystal matching game. Students match word pairs, image-to-word pairs, or word-to-word pairs by clicking floating crystals in a space scene.

## Input Data (for TA content generation)

Generate a JSON object with key `game_data` containing a string of JSON with pairs and optional sub_type.

**WordToWord** — text-only matching (e.g. English-Spanish pairs):
```json
{ "sub_type": "WordToWord", "pairs": [["cat", "gato"], ["dog", "perro"], ["house", "casa"]] }
```

**Structured pairs** — with optional images:
```json
{ "pairs": [{ "id": 1, "item1": { "value": "cat" }, "item2": { "value": "gato" } }] }
```

Create 4-8 pairs appropriate for the student's level.

## State Updates (what teacher receives)

- `{ status: "playing", score, pairsLeft }` — during play
- `{ lastAction: "match_correct", score, pairsLeft }` — correct match
- `{ lastAction: "match_incorrect", score, pairsLeft }` — wrong match
- `{ status: "won", score, pairsLeft: 0 }` — all pairs matched

## Teacher Guide

- Encourage the student to look for connections between crystals
- React to correct/incorrect matches with enthusiasm
- When pairsLeft is low, build excitement ("Just 2 more!")
- After completion, review any pairs the student struggled with
