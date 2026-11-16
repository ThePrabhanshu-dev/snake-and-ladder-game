/* Ludo — the browser game. Board rendering, turn handling and the optional
 * computer player. All game rules live in ludo-rules.js so that the Node
 * test suite can verify the same behaviour.
 */
(function () {
  "use strict";

  const Rules = window.LudoRules;
  if (!Rules) {
    document.body.insertAdjacentHTML("afterbegin",
      '<p style="color:#fca5a5;padding:20px">ludo-rules.js could not be loaded, so the game cannot start.</p>');
    return;
  }

  const SIZE = Rules.SIZE;
  const YARD = Rules.YARD;
  const CENTER_INDEX = Rules.CENTER_INDEX;
  const COLORS = Rules.COLORS;

  const el = function (id) { return document.getElementById(id); };
  const boardEl = el("ludoBoard");
  const diceEl = el("ludoDice");
  const diceLabelEl = el("ludoDiceLabel");
  const rollBtn = el("ludoRoll");
  const restartBtn = el("ludoRestart");
  const addBtn = el("ludoAddPlayer");
  const removeBtn = el("ludoRemovePlayer");
  const aiBtn = el("ludoAiToggle");
  const soundBtn = el("ludoSoundToggle");
  const msgEl = el("ludoMsg");
  const playersEl = el("ludoPlayers");
  const winOverlay = el("ludoWinOverlay");
  const winTitle = el("ludoWinTitle");
  const winSub = el("ludoWinSub");
  const statGames = el("ludoStatGames");
  const statWins = el("ludoStatWins");
  const statStreak = el("ludoStatStreak");

  const Fx = window.Fx || {
    play: function () {}, toast: function () {}, confetti: function () {},
    isEnabled: function () { return false; }, setEnabled: function () {}, toggle: function () {}
  };

  const STATS_KEY = "ludo-stats-v1";
  let stats = { games: 0, wins: 0, streak: 0, bestStreak: 0, winsByColor: {} };

  let state = null;
  let pendingMoves = [];
  let rolling = false;
  let busy = false;
  let lastRoll = 0;
  let settings = { count: 4, ai: false };

  /* ------------------------------------------------------------------ */
  /* board construction                                                   */
  /* ------------------------------------------------------------------ */

  const cellEls = {};   // cellKey -> element
  const cellInfo = {};  // cellKey -> { type, colorId }

  function key(r, c) { return r * SIZE + c; }

  function setCell(r, c, info) {
    cellInfo[key(r, c)] = info;
  }

  function classifyCells() {
    // The track first — a start square is also a track square, so it is
    // painted over afterwards.
    Rules.TRACK.forEach(function (cell) {
      setCell(cell[0], cell[1], {
        type: Rules.isSafeCell(cell) ? "safe" : "track",
        colorId: null
      });
    });

    COLORS.forEach(function (col) {
      const y = col.yard;
      for (let r = y.r0; r <= y.r1; r++) {
        for (let c = y.c0; c <= y.c1; c++) setCell(r, c, { type: "yard", colorId: col.id });
      }
      col.home.forEach(function (cell) { setCell(cell[0], cell[1], { type: "home", colorId: col.id }); });
      const start = Rules.startCell(col.id);
      setCell(start[0], start[1], { type: "start", colorId: col.id });
    });

    setCell(Rules.CENTER[0], Rules.CENTER[1], { type: "center", colorId: null });
  }

  function buildBoard() {
    classifyCells();
    const frag = document.createDocumentFragment();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const info = cellInfo[key(r, c)] || { type: "blank", colorId: null };
        const div = document.createElement("div");
        div.className = "cell cell-" + info.type + (info.colorId ? " c-" + info.colorId : "");
        div.dataset.r = String(r);
        div.dataset.c = String(c);
        if (info.type === "safe") {
          const star = document.createElement("span");
          star.className = "safe-star";
          star.textContent = "★";
          div.appendChild(star);
        }
        cellEls[key(r, c)] = div;
        frag.appendChild(div);
      }
    }
    boardEl.appendChild(frag);
  }

  /* ------------------------------------------------------------------ */
  /* state                                                                */
  /* ------------------------------------------------------------------ */

  function newGame(playerCount, aiIndex) {
    const ids = Rules.colorsFor(playerCount);
    settings.count = ids.length;
    settings.ai = aiIndex !== undefined && aiIndex !== null;
    state = {
      players: ids.map(function (id) {
        return { colorId: id, tokens: [YARD, YARD, YARD, YARD], isAI: false };
      }),
      turn: 0,
      sixes: 0,
      over: false,
      startedAt: Date.now()
    };
    if (aiIndex !== undefined && aiIndex !== null && aiIndex < state.players.length) {
      state.players[aiIndex].isAI = true;
    }
    pendingMoves = [];
    rolling = false;
    busy = false;
    hideWin();
    renderAll();
    message("Player 1 (" + colorName(state.players[0].colorId) + ") — roll the dice to begin.");
  }

  function colorName(id) {
    const c = Rules.colorById(id);
    return c.name;
  }

  function colorHex(id) {
    return Rules.colorById(id).hex;
  }

  function current() { return state.players[state.turn]; }

  /* ------------------------------------------------------------------ */
  /* rendering                                                            */
  /* ------------------------------------------------------------------ */

  function renderAll() {
    renderTokens();
    renderPlayers();
    renderStats();
    updateControls();
  }

  function renderTokens() {
    boardEl.querySelectorAll(".token").forEach(function (t) { t.remove(); });
    boardEl.querySelectorAll(".cell.target").forEach(function (t) { t.classList.remove("target"); });
    if (!state) return;

    const perCell = {};
    state.players.forEach(function (pl, pi) {
      pl.tokens.forEach(function (pos, ti) {
        const cell = Rules.tokenCell(pl, ti);
        const k = key(cell[0], cell[1]);
        const cellEl = cellEls[k];
        if (!cellEl) return;
        const slot = perCell[k] = (perCell[k] || 0);
        perCell[k] = slot + 1;
        const tok = document.createElement("span");
        tok.className = "token c-" + pl.colorId + " slot-" + Math.min(slot, 3) + (pl.isAI ? " ai" : "");
        tok.dataset.player = String(pi);
        tok.dataset.token = String(ti);
        cellEl.appendChild(tok);
      });
    });
  }

  function renderPlayers() {
    if (!state) return;
    playersEl.innerHTML = "";
    state.players.forEach(function (pl, pi) {
      const row = document.createElement("div");
      const home = Rules.atHome(pl);
      const yard = Rules.inYard(pl);
      row.className = "player-row" + (pi === state.turn && !state.over ? " active" : "") +
        (pl.isAI ? " ai" : "");
      row.innerHTML =
        '<span class="dot c-' + pl.colorId + '"></span>' +
        '<span class="pname">' + (pi + 1) + " · " + colorName(pl.colorId) + (pl.isAI ? " (CPU)" : "") + "</span>" +
        '<span class="pcount">🏠 ' + home + "/4" + (yard ? " · yard " + yard : "") + "</span>";
      playersEl.appendChild(row);
    });
  }

  function renderStats() {
    if (statGames) statGames.textContent = String(stats.games);
    if (statWins) statWins.textContent = String(stats.wins);
    if (statStreak) statStreak.textContent = String(stats.streak);
  }

  function updateControls() {
    if (!state) return;
    const aiTurn = !state.over && current().isAI;
    const active = !state.over && !rolling && !busy && !aiTurn;
    rollBtn.disabled = !active;
    if (aiBtn) {
      const aiOn = state.players.some(function (p) { return p.isAI; });
      aiBtn.textContent = aiOn ? "Remove computer" : "Play vs computer";
    }
    if (removeBtn) removeBtn.disabled = state.players.length <= 2;
    if (addBtn) addBtn.disabled = state.players.length >= 4;
  }

  function message(text) {
    if (msgEl) msgEl.textContent = text;
  }

  function setDice(value) {
    if (!diceEl) return;
    const pips = diceEl.querySelectorAll(".pip");
    const layout = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };
    const on = layout[value] || [];
    pips.forEach(function (p, i) { p.classList.toggle("on", on.indexOf(i) !== -1); });
    diceEl.dataset.value = String(value);
  }

  /* ------------------------------------------------------------------ */
  /* turn flow                                                            */
  /* ------------------------------------------------------------------ */

  function roll(byComputer) {
    if (!state || state.over || rolling || busy) return;
    // A human never rolls for the computer — it rolls by itself.
    if (!byComputer && current().isAI) return;
    rolling = true;
    updateControls();
    const roll = 1 + Math.floor(Math.random() * 6);
    diceEl.classList.remove("rolling");
    void diceEl.offsetWidth;           // restart the animation
    diceEl.classList.add("rolling");
    setTimeout(function () { setDice(roll); }, 220);
    Fx.play("dice");

    setTimeout(function () {
      rolling = false;
      handleRoll(roll);
    }, 520);
  }

  function handleRoll(roll) {
    const player = current();
    lastRoll = roll;
    if (diceLabelEl) diceLabelEl.textContent = "Rolled " + roll;
    const moves = Rules.legalMoves(state, state.turn, roll);
    pendingMoves = moves;

    if (!moves.length) {
      pendingMoves = [];
      Fx.play("snake");
      message(colorName(player.colorId) + " rolled a " + roll + " but has no legal move. Turn passes.");
      state.sixes = 0;
      renderAll();
      setTimeout(nextTurn, 700);
      return;
    }

    if (roll === 6) {      Fx.play("six");
      state.sixes += 1;
      if (state.sixes >= Rules.THREE_SIXES) {
        state.sixes = 0;
        // The token moved on the previous six goes back to its yard.
        let penalty = null;
        if (state.lastMoved && state.lastMoved.player === state.turn) {
          player.tokens[state.lastMoved.token] = YARD;
          penalty = state.lastMoved.token;
        }
        state.lastMoved = null;
        message(colorName(player.colorId) + " rolled three sixes!" +
          (penalty !== null ? " The token goes back to the yard." : " The turn is lost."));
        Fx.play("tripleSix");
        renderAll();
        setTimeout(nextTurn, 900);
        return;
      }
    } else {
      state.sixes = 0;
    }

    highlightMoves();

    if (player.isAI) {
      setTimeout(function () { aiTakeTurn(roll); }, 550);
      return;
    }

    message(colorName(player.colorId) + " rolled a " + roll + " — pick a glowing token to move.");
  }

  function highlightMoves() {
    boardEl.querySelectorAll(".token.movable").forEach(function (t) { t.classList.remove("movable"); });
    boardEl.querySelectorAll(".cell.target").forEach(function (t) { t.classList.remove("target"); });
    const seen = {};
    pendingMoves.forEach(function (m) {
      const tok = boardEl.querySelector('.token[data-player="' + state.turn + '"][data-token="' + m.token + '"]');
      if (tok) tok.classList.add("movable");
      const cell = Rules.pathFor(current().colorId)[m.to];
      if (cell) {
        const k = key(cell[0], cell[1]);
        if (!seen[k]) {
          seen[k] = true;
          const cellEl = cellEls[k];
          if (cellEl) cellEl.classList.add("target");
        }
      }
    });
  }

  function findMove(playerIndex, tokenIndex) {
    for (let i = 0; i < pendingMoves.length; i++) {
      if (pendingMoves[i].token === tokenIndex) return pendingMoves[i];
    }
    return null;
  }

  function playMove(move, diceRoll) {
    const player = current();
    const result = Rules.applyMove(state, state.turn, move);
    // Only the token moved on a six can be sent back by a third six.
    state.lastMoved = diceRoll === 6 ? { player: state.turn, token: move.token } : null;
    pendingMoves = [];
    boardEl.querySelectorAll(".token.movable").forEach(function (t) { t.classList.remove("movable"); });
    boardEl.querySelectorAll(".cell.target").forEach(function (t) { t.classList.remove("target"); });

    if (result.captured) {
      const victim = state.players[result.captured.player];
      Fx.play("snake");
      message(colorName(victim.colorId) + "'s token was captured and sent back to the yard!");
    } else if (result.home) {
      Fx.play("ladder");
      message(colorName(player.colorId) + " brought a token home.");
    } else {
      Fx.play("step");
      message(colorName(player.colorId) + " moved a token.");
    }

    renderAll();

    if (Rules.hasWon(player)) {
      finishGame(state.turn);
      return;
    }

    if (state.sixes > 0 && state.sixes < Rules.THREE_SIXES) {
      message(messageText() + " A six — roll again!");
      updateControls();
      if (player.isAI) setTimeout(function () { roll(true); }, 800);
      return;
    }

    setTimeout(nextTurn, 500);
  }

  function messageText() {
    return msgEl ? msgEl.textContent : "";
  }

  function nextTurn() {
    if (!state || state.over) return;
    state.turn = (state.turn + 1) % state.players.length;
    state.sixes = 0;
    state.lastMoved = null;
    pendingMoves = [];
    renderAll();
    const p = current();
    message((p.isAI ? "Computer" : "Player " + (state.turn + 1)) +
      " (" + colorName(p.colorId) + "), you're up — roll the dice.");
    updateControls();
    if (p.isAI) setTimeout(function () { roll(true); }, 800);
  }

  function finishGame(winnerIndex) {
    state.over = true;
    const winner = state.players[winnerIndex];
    stats.games += 1;
    stats.wins += 1;
    stats.streak += 1;
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    stats.winsByColor[winner.colorId] = (stats.winsByColor[winner.colorId] || 0) + 1;
    saveStats();
    renderAll();

    if (winTitle) winTitle.textContent = (winnerIndex + 1) + ". " + colorName(winner.colorId) + " wins!";
    if (winSub) winSub.textContent = "All four tokens reached the centre" +
      (winner.isAI ? " — the computer played well." : " — well played.");
    if (winOverlay) winOverlay.classList.add("show");
    Fx.play("win");
    Fx.confetti({ colors: [colorHex(winner.colorId), "#ffd166", "#ffffff"] });
    message(colorName(winner.colorId) + " wins the game!");
  }

  function hideWin() {
    if (winOverlay) winOverlay.classList.remove("show");
  }

  /* ------------------------------------------------------------------ */
  /* computer player                                                      */
  /* ------------------------------------------------------------------ */

  /** The track index of a position, or null for the home column. */
  function trackIndexOf(colorId, pos) {
    if (pos < 0 || pos > Rules.TRACK_LEN - 1) return null;
    const start = Rules.colorById(colorId).startIndex;
    return (start + pos) % Rules.TRACK_LEN;
  }

  function scoreMove(playerIndex, move) {
    const pl = state.players[playerIndex];
    const color = Rules.colorById(pl.colorId);
    let score = 0;

    if (move.capture) score += 130;
    if (move.to === CENTER_INDEX) score += 220;
    if (move.from === YARD) score += 45;                     // get out of the yard

    const destCell = Rules.pathFor(pl.colorId)[move.to];
    if (Rules.isSafeCell(destCell)) score += 30;
    else score -= 12;

    // A token that sits just behind an opponent can be captured next turn.
    const myTrack = trackIndexOf(pl.colorId, move.to);
    if (myTrack !== null && !Rules.isSafeCell(destCell)) {
      state.players.forEach(function (op, oi) {
        if (oi === playerIndex) return;
        op.tokens.forEach(function (pos) {
          const opTrack = trackIndexOf(op.colorId, pos);
          if (opTrack === null) return;
          const gap = (myTrack - opTrack + Rules.TRACK_LEN) % Rules.TRACK_LEN;
          if (gap >= 1 && gap <= 6) score -= 22;
        });
      });
    }

    score += (move.to - move.from) * 3;

    // Prefer keeping one token close to home when others are still out.
    const home = Rules.atHome(pl);
    if (home >= 2 && move.to < Rules.TRACK_LEN) score -= 6;

    return score;
  }

  function aiTakeTurn(roll) {
    if (!state || state.over || !pendingMoves.length) return;
    let best = null, bestScore = -Infinity;
    pendingMoves.forEach(function (m) {
      const s = scoreMove(state.turn, m) + Math.random() * 6;
      if (s > bestScore) { bestScore = s; best = m; }
    });
    if (!best) return;
    message("Computer (" + colorName(current().colorId) + ") rolled a " + roll + " — moving.");
    setTimeout(function () { if (state && !state.over) playMove(best, roll); }, 450);
  }

  /* ------------------------------------------------------------------ */
  /* stats                                                                */
  /* ------------------------------------------------------------------ */

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) stats = Object.assign(stats, JSON.parse(raw));
    } catch (e) { /* storage blocked — stats stay in memory */ }
  }

  function saveStats() {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* input                                                                */
  /* ------------------------------------------------------------------ */

  boardEl.addEventListener("click", function (ev) {
    if (!state || state.over || busy || rolling) return;
    if (current().isAI) return;
    const tok = ev.target.closest ? ev.target.closest(".token") : null;
    if (!tok) return;
    const tokenIndex = parseInt(tok.dataset.token, 10);
    const move = findMove(state.turn, tokenIndex);
    if (!move) return;
    busy = true;
    updateControls();
    playMove(move, lastRoll);
    busy = false;
    updateControls();
  });

  rollBtn.addEventListener("click", function () { roll(false); });
  restartBtn.addEventListener("click", function () {
    newGame(settings.count, settings.ai ? 1 : null);
  });

  addBtn.addEventListener("click", function () {
    if (settings.count >= 4) return;
    newGame(settings.count + 1, settings.ai ? 1 : null);
  });

  removeBtn.addEventListener("click", function () {
    if (settings.count <= 2) return;
    newGame(settings.count - 1, settings.ai ? 1 : null);
  });

  aiBtn.addEventListener("click", function () {
    if (settings.ai) newGame(settings.count, null);
    else newGame(settings.count, settings.count > 1 ? 1 : 0);
  });

  soundBtn.addEventListener("click", function () {
    const on = Fx.toggle();
    soundBtn.textContent = on ? "Mute sounds" : "Unmute sounds";
  });

  el("ludoWinAgain").addEventListener("click", function () {
    hideWin();
    newGame(settings.count, settings.ai ? 1 : null);
  });
  el("ludoWinClose").addEventListener("click", hideWin);

  document.addEventListener("keydown", function (ev) {
    if (ev.code === "Space" && ev.target === document.body) {
      ev.preventDefault();
      roll();
    }
  });

  /* ------------------------------------------------------------------ */
  /* start                                                                */
  /* ------------------------------------------------------------------ */

  loadStats();
  buildBoard();
  newGame(4);
  if (soundBtn) soundBtn.textContent = Fx.isEnabled() ? "Mute sounds" : "Unmute sounds";
})();
