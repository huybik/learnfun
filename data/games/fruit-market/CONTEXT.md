# Fruit Market Game

Standalone Vite/vanilla-TS game served in an iframe. No React.

## Game Flow

3 waves, each: **learn 3 fruits → quiz 3 → 2 mini-games → shop** (repeat). Last wave skips shop → end screen.

- **Starters**: apple, banana, orange (free). Subsequent waves: kid picks 3 via shop (costs coins).
- **Score** = total coins earned (never decreases). **Coins** = spendable in shop.
- Wave games: 2 randomly picked from available mini-games (avoids repeats when possible).

## Phases

| Phase | File | Description |
|-------|------|-------------|
| learn | `phases/learn.ts` | Show each fruit's SVG, title, fact. Click to advance. |
| play | `phases/play.ts` | Quiz: hint text + 6 fruit cards, pick the correct one. Modes: normal, shadow (silhouette), describe (no label). Timer optional. Auto-reveal after 3 wrong. |
| memory | `phases/memory.ts` | Flip-card matching pairs. Up to 4 pairs from known fruits. DOM-patched (no full re-render per flip). |
| oddoneout | `phases/oddoneout.ts` | 4 fruits, 3 share a color group, pick the odd one. Uses `FRUIT_COLORS` grouping. Needs >=4 known fruits. |
| pattern | `phases/pattern.ts` | Sequence [A,B,A,B,?] — pick what comes next. Needs >=2 known fruits. |
| sort | `phases/sort.ts` | Drag-or-tap fruits into color-coded baskets. 2-3 color groups, 2 fruits each. Needs >=6 known fruits. |
| juice | `phases/juice.ts` | Pick fruits matching a drink recipe. 9 recipes in `DRINK_RECIPES`. Only available if all recipe fruits are known. |
| shop | `phases/shop.ts` | Buy 3 new fruits (cost `fruitPrice` each). Auto-advances when basket full. |
| end | `phases/end.ts` | Trophy screen with score summary. Calls `bridge.endGame()`. |

## Architecture

### Entry: `main.ts`
Creates `GameBridge` (from `@learnfun/game-sdk`), registers `FruitMarketGame`. Defines action schema + default init data (16 fruits with title/fact/hint).

### Core: `game.ts` — `FruitMarketGame` class
Implements `GameAPI` (init, handleAction, getState, destroy) + `GameCtx` interface.

- **`init(data)`**: Parses fruit data, sets starters, builds wave data (intro items + challenge pools + mini-game rounds), assigns 2 random mini-games.
- **`handleAction(name, params)`**: Routes universal actions (submit, next, reveal, jump, end, set) to phase-specific handlers.
- **`getState()`**: Returns phase-specific state snapshot for the bridge.
- **`render()`**: Dispatches to phase render function. Adds `phase-active` class after 600ms (suppresses entrance animations on re-renders).
- **`advance()`**: Phase-aware progression — next item within phase, or `advanceToNextGame()`.
- **`advanceToNextGame()`**: Next mini-game, or shop (if not last wave), or end.

### Types: `types.ts`
- `GameState`: Single flat state object (all phase states coexist).
- `GameCtx`: Shared context passed to all phase functions (root, state, bridge, render, advance, sync, advanceToNextGame, finish).
- Data types: `FruitInfo`, `Challenge`, `SortRound`, `MemoryRound`, `OddOneOutRound`, `PatternRound`, `DrinkRecipe`, `ShopItem`.

### Shared UI: `ui.ts`
- `renderHUD()`, `renderDots()`, `makeFruitCard()` — common UI builders.
- `awardPoints()` — coins + score + sfx + particles + float score.
- `handleQuizPick()` / `doQuizReveal()` — shared handlers for single-answer quiz phases (oddoneout, pattern).

### Other modules
- **`fruits.ts`**: SVG registry. Globs `assets/*.svg` at build time. Exports `FRUIT_NAMES`, `DRINK_NAMES`, `getFruitSvg()`, `getDrinkSvg()`.
- **`constants.ts`**: `WAVE_SIZE=3`, `TOTAL_WAVES=3`, `FRUIT_PRICE=10`, `STARTER_FRUITS`, `ALL_MINI_GAMES`, `FRUIT_COLORS`, `COLOR_EMOJIS`, `DRINK_RECIPES`, `BIN_COLORS`, `coloredBasket()` SVG.
- **`utils.ts`**: `el()`, `clamp()`, `gridCols()`, `shuffle()`.
- **`audio.ts`**: Web Audio API synth sfx (pop, correct, wrong, whoosh, coin, complete). No external files.
- **`drag.ts`**: Pointer-event drag-and-drop (used by sort phase). Ghost element + drop zone detection.
- **`style.css`**: Full CSS — sky gradient bg, Fredoka font, card animations, phase-specific styles, responsive breakpoints.

## Data Flow

1. TA generates `{ fruits: { [name]: { title, fact, hint, mode? } } }` — passed via `bridge.init(data)`.
2. Mini-game data (memory rounds, pattern rounds, odd-one-out rounds, sort rounds) generated **in-game** from known fruits — not by TA.
3. State changes → `bridge.updateState(getState())` → postMessage to host → teacher gets context.
4. Events → `bridge.emitEvent(name, data)` → host forwards to teacher via `/api/teacher/message`.

## Key Patterns

- **No framework**: All DOM built with `el()` helper + innerHTML. Phase renders clear `root.innerHTML` and rebuild.
- **Memory phase exception**: Uses incremental DOM patching (flip/unflip/match individual cards) instead of full re-render.
- **Auto-advance timers**: Most phases auto-advance after correct answer (1.5-2.2s delay via `s.advanceTimer`).
- **Streak tracking**: Consecutive correct answers increment `s.streak`; wrong resets to 0. Shown in HUD when >=2.
- **Phase-active class**: Added 600ms after render to suppress CSS entrance animations on same-phase re-renders.
