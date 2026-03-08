---
id: spaceshooter
name: Space Shooter
tags: [arcade, reward, fun, space]
maxPlayers: 1
---

# Space Shooter

Top-down arcade space shooter with 30 progressive waves, power-ups, boss fights, and planet backgrounds. A reward game — no content generation needed.

## Input Data (for TA content generation)

This is a self-contained reward game. Just provide an empty object:
```json
{}
```

Optionally `{ "startWave": 1 }` to configure the starting wave.

## State Updates (what teacher receives)

- `{ status: "playing", score, wave, lives, health, enemiesAlive }` — periodic updates
- `{ status: "game_over", finalScore, wavesReached, enemiesDestroyed }` — game ended

## Teacher Guide

- This is a reward game — offer it after the student completes a lesson or does well
- Hype it up! ("You've earned a break! Want to play Space Shooter?")
- During play, react to score milestones and wave completions
- Keep commentary light and fun, don't distract from gameplay
- When game ends, congratulate on the score and suggest returning to learning
