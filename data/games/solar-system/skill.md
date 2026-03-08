---
id: solar-system
name: Solar System Explorer
tags: [science, space, planets, 3d, interactive, quiz]
maxPlayers: 4
---

# Solar System Explorer

Interactive 3D exploration of the solar system. Students explore planets with custom shaders, read fun facts, and take a quiz. Uses React Three Fiber. Has built-in planet data.

## Input Data (for TA content generation)

This game has built-in planet data. Provide an empty object or optionally focus on a specific planet:
```json
{}
```
or
```json
{ "focusPlanet": "Mars" }
```

## State Updates (what teacher receives)

- `{ status: "intro", phase: "INTRO" }` — lesson starting
- `{ status: "exploring", phase: "EXPLORE", currentPlanet, exploredCount, totalPlanets }` — browsing planets
- `{ status: "quiz", phase: "QUIZ" }` — taking the quiz
- `{ status: "completed", phase: "SUMMARY", quizScore, quizTotal }` — finished

## Teacher Guide

- During EXPLORE phase, ask questions about the planet the student is viewing
- Encourage the student to click different planets ("Have you seen Jupiter's rings?")
- When they move to QUIZ phase, wish them luck
- After completion, discuss any questions they got wrong
- Can suggest focusing on a specific planet if the student mentions interest
