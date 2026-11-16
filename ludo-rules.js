
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LudoRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SIZE = 15;
  const TRACK_LEN = 56;
  const HOME_LEN = 6;
  const CENTER_INDEX = TRACK_LEN + 1 + HOME_LEN;
  const START_AGAIN = TRACK_LEN;
  const HOME_START = TRACK_LEN + 1;
  const YARD = -1;
  const TOKENS = 4;
  const THREE_SIXES = 3;

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

  const SAFE_TRACK_INDEXES = [7, 21, 35, 49];

  function cellKey(cell) { return cell[0] * SIZE + cell[1]; }

  const pathCache = {};
  const pathById = {};
  COLORS.forEach(function (c) {
    const cells = [];
    for (let i = 0; i < TRACK_LEN; i++) cells.push(TRACK[(c.startIndex + i) % TRACK_LEN]);
    cells.push(TRACK[c.startIndex]);
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

  function pathFor(colorId) {
    const p = pathById[colorId];
    if (!p) throw new Error("unknown colour: " + colorId);
    return p;
  }

  function startCell(colorId) { return TRACK[colorById(colorId).startIndex]; }

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

  function colorsFor(count) {
    const n = Math.max(2, Math.min(4, count | 0));
    if (n === 2) return ["red", "yellow"];
    if (n === 3) return ["red", "blue", "yellow"];
    return COLORS.map(function (c) { return c.id; });
  }

  function isSafeCell(cell) { return !!safeCells[cellKey(cell)]; }

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
      if (pos === CENTER_INDEX) return;

      if (pos === YARD) {

        if (roll !== 6) return;
        const start = path[0];
        const blockers = (occ[cellKey(start)] || []).filter(function (o) {
          return o.player !== playerIndex;
        });
        if (blockers.length >= 2) return;
        moves.push({ token: ti, from: YARD, to: 0, capture: null });
        return;
      }

      const to = pos + roll;

      const max = pos <= TRACK_LEN - 1 ? START_AGAIN : CENTER_INDEX;
      if (to > max) return;

      for (let i = pos + 1; i < to; i++) {
        const others = (occ[cellKey(path[i])] || []).filter(function (o) {
          return o.player !== playerIndex;
        });
        if (others.length >= 2) return;
      }

      const there = (occ[cellKey(path[to])] || []).filter(function (o) {
        return o.player !== playerIndex;
      });
      if (there.length >= 2) return;
      const capture = (there.length === 1 && !isSafeCell(path[to])) ? there[0] : null;

      moves.push({ token: ti, from: pos, to: to, capture: capture });
    });

    return moves;
  }

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

  function hasWon(player) {
    return player.tokens.every(function (pos) { return pos === CENTER_INDEX; });
  }

  function inYard(player) {
    return player.tokens.filter(function (pos) { return pos === YARD; }).length;
  }

  function atHome(player) {
    return player.tokens.filter(function (pos) { return pos === CENTER_INDEX; }).length;
  }

  function tokenCell(player, tokenIndex) {
    const pos = player.tokens[tokenIndex];
    if (pos === YARD) return yardSlot(player.colorId, tokenIndex);
    return pathFor(player.colorId)[pos];
  }

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
