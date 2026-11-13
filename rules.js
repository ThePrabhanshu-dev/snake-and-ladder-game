/* Snake & Ladder — core rules (shared by the browser game and the Node tests) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SnakeLadderRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TOTAL = 100;
  const COLS = 10;

  // Square -> destination. Higher = ladder, lower = snake.
  const JUMPS = {
    1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98,
    16: 6, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75
  };

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

  /**
   * Play one turn for a player.
   * @param {{pos:number}} player
   * @param {number} roll 1..6
   * @param {number} sixesInRow consecutive 6s before this roll
   * @returns {{pos:number, sixes:number, bonus:boolean, overshoot:boolean,
   *            tripleSix:boolean, won:boolean, jumps:Array}}
   */
  function step(player, roll, sixesInRow) {
    let sixes = sixesInRow;
    let pos = player.pos;

    if (roll === 6) {
      sixes += 1;
      if (sixes === 3) {
        return { pos: 1, sixes: 0, bonus: false, overshoot: false, tripleSix: true, won: false, jumps: [] };
      }
    } else {
      sixes = 0;
    }

    if (pos + roll > TOTAL) {
      return { pos, sixes, bonus: false, overshoot: true, tripleSix: false, won: false, jumps: [] };
    }

    pos += roll;
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

  return { TOTAL, COLS, JUMPS, coord, resolve, step };
});
