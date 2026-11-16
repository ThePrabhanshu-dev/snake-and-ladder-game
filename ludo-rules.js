/* Ludo — core rules (shared by the browser game and the Node tests).
 *
 * Board layout (15 x 15 grid):
 *
 *   - Four 6 x 6 home yards sit in the corners.
 *   - A 56 square track loops around the middle of the board.
 *   - Each colour owns one 6 square home column that leads into the centre
 *     square, and one start square where its tokens enter the track.
 *   - Eight squares are safe: the four start squares and the four squares
 *     that sit right in front of the home columns.
 *
 * A token walks a fixed path of 64 squares: 56 track squares, the start
 * square one last time, the 6 home column squares and finally the centre.
 * That keeps the "you must land on your start square before you can enter
 * the home column" rule honest and makes every position a simple integer.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LudoRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SIZE = 15;
  const TRACK_LEN = 56;                                   // track squares
  const HOME_LEN = 6;                                     // home column squares
  const CENTER_INDEX = TRACK_LEN + 1 + HOME_LEN;          // 63 — the centre
  const START_AGAIN = TRACK_LEN;                          // 56 — start square, 2nd lap
  const HOME_START = TRACK_LEN + 1;                       // 57 — first home square
  const YARD = -1;                                        // token waiting in its yard
  const TOKENS = 4;
  const THREE_SIXES = 3;                                  // three sixes in a row is a foul

  /* The track, in travel order. It is a closed loop of 56 squares. */
  const TRACK = [
    [0, 7], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
    [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0],
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [9, 6], [10, 6],
    [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8], [13, 8], [12, 8],
    [11, 8], [10, 8], [9, 8], [8, 8], [8, 9], [8, 10], [8, 11], [8, 12],
    [8, 13], [8, 14], [7, 14], [6, 14], [6, 13], [6, 12], [6, 11], [6, 10],
    [6, 9], [6, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];

  const CENTER = [7, 7];

  /* The four colours. `startIndex` points at the track square the colour
     enters the track on; `home` lists the home column from the square next
     to the start square down to the square next to the centre. */
  const COLORS = [
    {
      id: "red", name: "Red", hex: "#ef4444", startIndex: 12,
      home: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
      yard: { r0: 0, r1: 5, c0: 0, c1: 5 }
    },
    {
      id: "blue", name: "Blue", hex: "#3b82f6", startIndex: 26,
      home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
      yard: { r0: 9, r1: 14, c0: 0, c1: 5 }
    },
    {
      id: "yellow", name: "Yellow", hex: "#f5b301", startIndex: 40,
      home: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
      yard: { r0: 9, r1: 14, c0: 9, c1: 14 }
    },
    {
      id: "green", name: "Green", hex: "#22c55e", startIndex: 54,
      home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
      yard: { r0: 0, r1: 5, c0: 9, c1: 14 }
    }
  ];

  /* Track squares that cannot be captured on: the four start squares plus the
     four squares that sit directly in front of the home columns. */
  const SAFE_TRACK_INDEXES = [7, 21, 35, 49];

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  function cellKey(cell) { return cell[0] * SIZE + cell[1]; }

  const pathCache = {};
  const pathById = {};
  COLORS.forEach(function (c) {
    const cells = [];
    for (let i = 0; i < TRACK_LEN; i++) cells.push(TRACK[(c.startIndex + i) % TRACK_LEN]);
    cells.push(TRACK[c.startIndex]);          // start square, one lap later
    c.home.forEach(function (h) { cells.push(h); });
    cells.push(CENTER);
    pathCache[c.id] = cells;
    pathById[c.id] = cells;
  });

  const safeCells = (function () {
    const set = {};
    COLORS.forEach(function (c) { set[cellKey(TRACK[c.startIndex])] = true; });
    SAFE_TRACK_INDEXES.forEach(function (i) { set[cellKey(TRACK[i])] = true; });
    return set;
  })();

  /** The fixed path a token of `colorId` walks, from the start square to the centre. */
  function pathFor(colorId) {
    const p = pathById[colorId];
    if (!p) throw new Error("unknown colour: " + colorId);
    return p;
  }

  /** The square a colour starts on. */
  function startCell(colorId) { return TRACK[colorById(colorId).startIndex]; }

  /** The four yard slots where a colour's waiting tokens are drawn. */
  function yardSlot(colorId, tokenIndex) {
    const y = colorById(colorId).yard;
    const rows = [y.r0 + 1, y.r0 + 1, y.r0 + 4, y.r0 + 4];
    const cols = [y.c0 + 1, y.c0 + 4, y.c0 + 1, y.c0 + 4];
    return [rows[tokenIndex % 4], cols[tokenIndex % 4]];
  }

  function colorById(colorId) {
    for (let i = 0; i < COLORS.length; i++) if (COLORS[i].id === colorId) return COLORS[i];
    throw new Error("unknown colour: " + colorId);
  }

  /** Which colours take part in a game with `count` players (2, 3 or 4). */
  function colorsFor(count) {
    const n = Math.max(2, Math.min(4, count | 0));
    if (n === 2) return ["red", "yellow"];
    if (n === 3) return ["red", "blue", "yellow"];
    return COLORS.map(function (c) { return c.id; });
  }

  /** Is this square one of the eight safe squares? */
  function isSafeCell(cell) { return !!safeCells[cellKey(cell)]; }

  /** Map of cell -> list of {player, token} for every token on the board. */
  function occupancy(state) {
    const map = {};
    state.players.forEach(function (pl, pi) {
      const path = pathFor(pl.colorId);
      pl.tokens.forEach(function (pos, ti) {
        if (pos < 0 || pos > CENTER_INDEX) return;
        const cell = path[pos];
        const k = cellKey(cell);
        if (!map[k]) map[k] = [];
        map[k].push({ player: pi, token: ti, cell: cell });
      });
    });
    return map;
  }

  /**
   * Every move the given player can make with this dice roll.
   *
   * @param {{players:Array}} state
   * @param {number} playerIndex
   * @param {number} roll 1..6
   * @returns {Array<{token:number, from:number, to:number, capture:?object}>}
   */
  function legalMoves(state, playerIndex, roll) {
    if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
      throw new RangeError("roll must be an integer between 1 and 6, got " + roll);
    }
    const pl = state.players[playerIndex];
    if (!pl) throw new Error("no such player: " + playerIndex);

    const path = pathFor(pl.colorId);
    const occ = occupancy(state);
    const moves = [];

    pl.tokens.forEach(function (pos, ti) {
      if (pos === CENTER_INDEX) return;            // already home

      if (pos === YARD) {
        // A six is needed to bring a token out of the yard.
        if (roll !== 6) return;
        const start = path[0];
        const blockers = (occ[cellKey(start)] || []).filter(function (o) {
          return o.player !== playerIndex;
        });
        if (blockers.length >= 2) return;         // blocked by a pair
        moves.push({ token: ti, from: YARD, to: 0, capture: null });
        return;
      }

      const to = pos + roll;
      // From the track you may only reach your start square (second lap);
      // from there on you may only reach the centre, and only exactly.
      const max = pos <= TRACK_LEN - 1 ? START_AGAIN : CENTER_INDEX;
      if (to > max) return;

      // A pair of opposing tokens blocks the road.
      for (let i = pos + 1; i < to; i++) {
        const others = (occ[cellKey(path[i])] || []).filter(function (o) {
          return o.player !== playerIndex;
        });
        if (others.length >= 2) return;
      }

      const there = (occ[cellKey(path[to])] || []).filter(function (o) {
        return o.player !== playerIndex;
      });
      if (there.length >= 2) return;              // cannot land on a block
      const capture = (there.length === 1 && !isSafeCell(path[to])) ? there[0] : null;

      moves.push({ token: ti, from: pos, to: to, capture: capture });
    });

    return moves;
  }

  /**
   * Apply a move produced by `legalMoves` to the game state.
   *
   * The move itself is applied to the moving player and the captured token
   * (if any) is sent back to its yard. The state is updated in place so the
   * browser game and the Node tests share exactly the same behaviour.
   *
   * @param {{players:Array}} state
   * @param {number} playerIndex
   * @param {{token:number, from:number, to:number, capture:?object}} move
   * @returns {{player:number, token:number, captured:?object, home:boolean}}
   */
  function applyMove(state, playerIndex, move) {
    const pl = state.players[playerIndex];
    if (!pl) throw new Error("no such player: " + playerIndex);
    if (!move || typeof move !== "object") throw new Error("a move is required");
    if (!Number.isInteger(move.token) || move.token < 0 || move.token >= pl.tokens.length) {
      throw new RangeError("no such token: " + move.token);
    }

    pl.tokens[move.token] = move.to;

    let captured = null;
    if (move.capture) {
      const victim = state.players[move.capture.player];
      if (!victim) throw new Error("no such player: " + move.capture.player);
      victim.tokens[move.capture.token] = YARD;
      captured = move.capture;
    }

    return { player: playerIndex, token: move.token, captured: captured, home: move.to === CENTER_INDEX };
  }

  /** Has this player brought every token home? */
  function hasWon(player) {
    return player.tokens.every(function (pos) { return pos === CENTER_INDEX; });
  }

  /** How many tokens are still waiting in the yard. */
  function inYard(player) {
    return player.tokens.filter(function (pos) { return pos === YARD; }).length;
  }

  /** How many tokens already reached the centre. */
  function atHome(player) {
    return player.tokens.filter(function (pos) { return pos === CENTER_INDEX; }).length;
  }

  /** The square a token currently stands on (yard slots included). */
  function tokenCell(player, tokenIndex) {
    const pos = player.tokens[tokenIndex];
    if (pos === YARD) return yardSlot(player.colorId, tokenIndex);
    return pathFor(player.colorId)[pos];
  }

  /** A new game with the given colour list. */
  function newGame(colorIds) {
    const ids = (colorIds && colorIds.length) ? colorIds : colorsFor(4);
    return {
      players: ids.map(function (id) {
        return { colorId: id, tokens: [YARD, YARD, YARD, YARD] };
      }),
      turn: 0,
      sixes: 0
    };
  }

  return {
    SIZE, TRACK_LEN, HOME_LEN, TOKENS, THREE_SIXES,
    CENTER, CENTER_INDEX, START_AGAIN, HOME_START, YARD,
    TRACK, COLORS, SAFE_TRACK_INDEXES,
    cellKey, pathFor, startCell, yardSlot, colorById, colorsFor,
    isSafeCell, occupancy, legalMoves, applyMove, hasWon, inYard, atHome, tokenCell, newGame
  };
});
