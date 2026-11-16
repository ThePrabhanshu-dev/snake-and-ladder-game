
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SnakeLadderRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TOTAL = 100;
  const COLS = 10;
  const MAX_SIXES = 3;

  const LADDERS = {
    1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98
  };
  const SNAKES = {
    16: 6, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75
  };

  const JUMPS = Object.assign({}, LADDERS, SNAKES);

  function coord(n) {
    const row = Math.floor((n - 1) / COLS);
    let col = (n - 1) % COLS;
    if (row % 2 === 1) col = COLS - 1 - col;
    return { row, col };
  }

  function resolve(square) {
    const jumps = [];
    let cur = square;
    const seen = new Set();
    while (JUMPS[cur] !== undefined) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const to = JUMPS[cur];
      jumps.push({ from: cur, to });
      cur = to;
    }
    return { square: cur, jumps };
  }

  function describeSquare(square) {
    const to = JUMPS[square];
    if (to === undefined) {
      return { square, type: "plain", to: null, jumps: [] };
    }
    const type = to > square ? "ladder" : "snake";
    const r = resolve(square);
    return { square, type, to, jumps: r.jumps };
  }

  function isLadder(square) { return LADDERS[square] !== undefined; }
  function isSnake(square) { return SNAKES[square] !== undefined; }

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

        return { pos: 1, sixes: 0, bonus: false, overshoot: false, tripleSix: true, won: false, jumps: [] };
      }
    } else {
      sixes = 0;
    }

    if (start + roll > TOTAL) {

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
