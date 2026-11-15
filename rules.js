/* Snake & Ladder — core rules (shared by the browser game and the Node tests) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SnakeLadderRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TOTAL = 100;
  const COLS = 10;
  const MAX_SIXES = 3;          // three 6s in a row sends a player back to the start

  // Square -> destination. Higher = ladder, lower = snake.
  const LADDERS = {
    1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98
  };
  const SNAKES = {
    16: 6, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75
  };

  /* Single source of truth for every jump on the board. */
  const JUMPS = Object.assign({}, LADDERS, SNAKES);

  /* Boustrophedon numbering: row 0 is the bottom row, odd rows run right-to-left. */
  function coord(n) {
    const row = Math.floor((n - 1) / COLS);
    let col = (n - 1) % COLS;
    if (row % 2 === 1) col = COLS - 1 - col;
    return { row, col };
  }

  /**
   * Resolve a landing on `square` through every ladder/snake it triggers.
   * @returns {{square:number, jumps:Array<{from:number,to:number}>}}
   */
  function resolve(square) {
    const jumps = [];
    let cur = square;
    const seen = new Set();
    while (JUMPS[cur] !== undefined) {
      if (seen.has(cur)) break; // guard against a malformed cycle
      seen.add(cur);
      const to = JUMPS[cur];
      jumps.push({ from: cur, to });
      cur = to;
    }
    return { square: cur, jumps };
  }

  /** What happens when a player lands on `square`? */
  function describeSquare(square) {
    const to = JUMPS[square];
    if (to === undefined) {
      return { square, type: "plain", to: null, jumps: [] };
    }
    const type = to > square ? "ladder" : "snake";
    const r = resolve(square);
    return { square, type, to, jumps: r.jumps };
  }

  /** Is `square` the base of a ladder / the head of a snake? */
  function isLadder(square) { return LADDERS[square] !== undefined; }
  function isSnake(square) { return SNAKES[square] !== undefined; }

  /**
   * Play one turn for a player.
   *
   * The "sixes in a row" counter belongs to the player, not to the table: it is
   * read from `player.sixes` when present and the new value is returned in
   * `sixes` so the caller can store it back on that player. Passing it as the
   * third argument still works for simple callers and the test suite.
   *
   * @param {{pos:number, sixes?:number}} player
   * @param {number} roll 1..6
   * @param {number} [sixesInRow] consecutive 6s before this roll (fallback)
   * @returns {{pos:number, sixes:number, bonus:boolean, overshoot:boolean,
   *            tripleSix:boolean, won:boolean, jumps:Array}}
   */
  function step(player, roll, sixesInRow) {
    if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
      throw new RangeError("roll must be an integer between 1 and 6, got " + roll);
    }

    const start = player && Number.isFinite(player.pos) ? player.pos : 0;
    let sixes;
    if (player && Number.isInteger(player.sixes)) sixes = player.sixes;
    else if (Number.isInteger(sixesInRow)) sixes = sixesInRow;
    else sixes = 0;

    if (roll === 6) {
      sixes += 1;
      if (sixes >= MAX_SIXES) {
        // Three 6s in a row: back to the start and the counter is cleared.
        return { pos: 1, sixes: 0, bonus: false, overshoot: false, tripleSix: true, won: false, jumps: [] };
      }
    } else {
      sixes = 0;
    }

    if (start + roll > TOTAL) {
      // Needs an exact 100 to win. The turn is lost, but a 6 still counts
      // towards this player's three-sixes counter, so `sixes` is returned.
      return { pos: start, sixes, bonus: false, overshoot: true, tripleSix: false, won: false, jumps: [] };
    }

    let pos = start + roll;
    const r = resolve(pos);
    pos = r.square;

    return {
      pos,
      sixes,
      bonus: roll === 6,
      overshoot: false,
      tripleSix: false,
      won: pos === TOTAL,
      jumps: r.jumps
    };
  }

  /* ---------- deterministic randomness (daily challenge) ----------
   * The daily challenge needs the same dice sequence for every player on a
   * given day, so the RNG has to be reproducible from a date seed.
   */

  /** mulberry32 — small, fast, seedable PRNG returning floats in [0, 1). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** FNV-1a style string hash, used to turn a date string into a seed. */
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  return {
    TOTAL, COLS, MAX_SIXES,
    LADDERS, SNAKES, JUMPS,
    coord, resolve, describeSquare, isLadder, isSnake,
    step, mulberry32, hashSeed
  };
});
