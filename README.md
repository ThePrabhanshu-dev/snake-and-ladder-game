# 🐍 Snake & Ladder

A classic **Snake & Ladder** board game that runs in the browser. No build step, no dependencies — just open the file and play.

## Play

Open [index.html](index.html) in any modern browser, or serve the folder:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

> The page must be served over `http://` (or opened from disk) so that `rules.js` loads — browsers block `file://` script loads from sibling folders in some configurations.

## Features

- **10×10 board** with authentic boustrophedon numbering (1 at bottom-left, 100 at top-left)
- **9 ladders and 6 snakes**, drawn as SVG and precisely aligned to the squares they connect
- **2–4 players** — press **Add Player** to add up to 4 (restarting the game)
- **Animated dice** with a shake-and-roll effect
- **Token animation** — the pawn walks square by square, then rides the ladder or slides down the snake
- **Correct classic rules**:
  - Roll a **6** to roll again
  - Land on a ladder base → climb to the top
  - Land on a snake head → slide to the tail
  - You need an **exact 100** to win; overshooting ends your turn
  - **Three 6s in a row** sends you back to the start
- **Responsive layout** — board and side panel stack on narrow screens
- **Live position readout** for every player

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup, styling and the browser game (UI/animation layer) |
| `rules.js` | Shared game rules — board coordinates, ladders/snakes, turn resolution |
| `test.js` | Node test suite for `rules.js` |

## Tests

```bash
node test.js
```

Covers board coordinate mapping, ladder/snake resolution, movement, overshoot handling,
the win condition, the three-sixes penalty, and runs 500 randomized full games to confirm
no game can loop forever or push a pawn outside the 0–100 range.

```
43 passed, 0 failed
```

## Extending

Board layouts live in one place — the `JUMPS` map in `rules.js`:

```js
const JUMPS = {
  1: 38,   // ladder: square 1  → 38
  16: 6,   // snake:  square 16 → 6
  ...
};
```

A higher value is a ladder (up), a lower value is a snake (down). Add or remove entries
there and both the game board and the tests pick up the change automatically.
