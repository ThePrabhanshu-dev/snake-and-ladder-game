/* Snake & Ladder — the game itself.

   This file owns the board, the players, the dice and the turn loop. The
   rules live in rules.js (shared with the Node tests), the badges and
   statistics live in rewards.js and the quiz lives in quiz.js.

   Everything the player sees is driven from here, and the only thing
   written to the device are the player names.
 */
(function () {
  "use strict";

  const Rules = window.SnakeLadderRules;
  const Rewards = window.Rewards;
  const BoardQuiz = window.BoardQuiz;

  const TOTAL = Rules.TOTAL;
  const COLS = Rules.COLS;
  const JUMPS = Rules.JUMPS;

  /* Sound, confetti and toasts are optional - the game still works
     without them, it just goes quiet. */
  const Fx = window.Fx || {
    play: function () {},
    toast: function () {},
    confetti: function () {},
    isEnabled: function () { return false; },
    toggle: function () { return false; }
  };

  /* ---------- elements ---------- */

  const boardEl = document.getElementById("board");
  const tokensEl = document.getElementById("tokens");
  const diceEl = document.getElementById("dice");
  const diceLabel = document.getElementById("diceLabel");
  const rollBtn = document.getElementById("roll");
  const restartBtn = document.getElementById("restart");
  const addBtn = document.getElementById("addPlayer");
  const removeBtn = document.getElementById("removePlayer");
  const msgEl = document.getElementById("msg");
  const rulesBox = document.querySelector(".rules");
  const turnBanner = document.getElementById("turnBanner");
  const turnDot = document.getElementById("turnDot");
  const turnText = document.getElementById("turnText");

  const PLAYER_COLORS = ["p1", "p2", "p3", "p4"];
  const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];
  const NAMES_KEY = "snl-names-v1";
  const RULES_SEEN_KEY = "snl-rules-seen";

  /* ---------- state ---------- */

  let players = [];
  let turn = 0;
  let rolling = false;
  let winner = -1;
  let mode = "local";       // "local" (pass & play) or "ai" (vs computer)
  let challenge = null;     // { seed, rng, date, moves } during a daily run
  let moves = 0;
  let startedAt = 0;
  let maxPos = 0;
  let playerNames = loadNames();

  /* ---------- player names ---------- */

  function loadNames() {
    try {
      const raw = localStorage.getItem(NAMES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return DEFAULT_NAMES.map(function (fallback, i) {
            return typeof parsed[i] === "string" && parsed[i].trim()
              ? parsed[i].trim().slice(0, 16)
              : fallback;
          });
        }
      }
    } catch (e) { /* storage unavailable - fall back to the defaults */ }
    return DEFAULT_NAMES.slice();
  }

  function saveNames() {
    try { localStorage.setItem(NAMES_KEY, JSON.stringify(playerNames)); } catch (e) {}
  }

  function nameOf(i) {
    return playerNames[i] || DEFAULT_NAMES[i] || "Player " + (i + 1);
  }

  /** Save a name when the field loses focus or Enter is pressed. */
  function commitName(i, raw) {
    const clean = String(raw || "").trim().slice(0, 16);
    if (!clean) {
      const input = document.getElementById("name" + (i + 1));
      if (input) input.value = nameOf(i);
      return;
    }
    if (clean === playerNames[i]) return;
    playerNames[i] = clean;
    saveNames();
    renderPanels();
    renderTurn();
    if (diceLabel && !rolling && winner === -1) diceLabel.textContent = nameOf(turn) + "'s turn";
  }

  /* ---------- the board ---------- */

  function coord(n) { return Rules.coord(n); }

  function buildBoard() {
    boardEl.querySelectorAll(".cell").forEach(function (cell) { cell.remove(); });

    let linksEl = boardEl.querySelector(".links");
    if (!linksEl) {
      linksEl = document.createElement("div");
      linksEl.className = "links";
      boardEl.insertBefore(linksEl, tokensEl);
    }
    linksEl.innerHTML = "";

    for (let n = 1; n <= TOTAL; n++) {
      const pos = coord(n);
      const cell = document.createElement("div");
      cell.className = "cell" + ((pos.row + pos.col) % 2 ? " light" : "");
      if (n === 1) cell.classList.add("start");
      if (n === TOTAL) cell.classList.add("finish");
      cell.textContent = n;
      cell.style.gridRow = String(COLS - pos.row);
      cell.style.gridColumn = String(pos.col + 1);
      cell.dataset.n = n;

      // Describe the square for screen readers: what is on it and where it
      // leads. role="img" makes the label announced when a screen reader
      // browses the board.
      const dest = JUMPS[n];
      cell.setAttribute("role", "img");
      if (dest === undefined) cell.setAttribute("aria-label", "Square " + n);
      else if (dest > n) cell.setAttribute("aria-label", "Square " + n + ", ladder to " + dest);
      else cell.setAttribute("aria-label", "Square " + n + ", snake to " + dest);

      boardEl.appendChild(cell);
    }

    drawLinks(linksEl);
  }

  /* Draw the ladders and snakes using measured cell centers, so the lines
     line up exactly with the squares. */
  function drawLinks(linksEl) {
    const area = linksEl.getBoundingClientRect();
    if (!area.width || !area.height) return;

    const center = function (n) {
      const cell = boardEl.querySelector('.cell[data-n="' + n + '"]');
      const rect = cell.getBoundingClientRect();
      return {
        x: ((rect.left + rect.width / 2) - area.left) / area.width * 100,
        y: ((rect.top + rect.height / 2) - area.top) / area.height * 100
      };
    };

    Object.keys(JUMPS).forEach(function (from) {
      const to = JUMPS[from];
      const link = document.createElement("div");
      link.className = "link";
      link.innerHTML = linkSVG(center(Number(from)), center(to), to > Number(from));
      linksEl.appendChild(link);
    });
  }

  function linkSVG(a, b, up) {
    // The colours come from CSS variables so they can be tuned per theme.
    // A presentation attribute cannot use var(), so the stroke and fill are
    // set through the style attribute instead.
    const color = up ? "var(--ladder-color)" : "var(--snake-color)";
    const stroke = 'style="stroke:' + color + '"';
    const fill = 'style="fill:' + color + '"';

    if (up) {
      // Ladder: two parallel rails with rungs between them.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;         // unit normal
      const half = 1.7;            // half the width of the ladder
      const a1 = { x: a.x + nx * half, y: a.y + ny * half };
      const a2 = { x: a.x - nx * half, y: a.y - ny * half };
      const b1 = { x: b.x + nx * half, y: b.y + ny * half };
      const b2 = { x: b.x - nx * half, y: b.y - ny * half };

      const rungs = [];
      const steps = 5;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        rungs.push('<line x1="' + (a1.x + (b1.x - a1.x) * t) + '" y1="' + (a1.y + (b1.y - a1.y) * t) +
          '" x2="' + (a2.x + (b2.x - a2.x) * t) + '" y2="' + (a2.y + (b2.y - a2.y) * t) +
          '" ' + stroke + ' stroke-width="1.3" stroke-linecap="round" opacity="0.9"/>');
      }

      return '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
        '<line x1="' + a1.x + '" y1="' + a1.y + '" x2="' + b1.x + '" y2="' + b1.y + '" ' + stroke +
        ' stroke-width="1.8" opacity="0.85"/>' +
        '<line x1="' + a2.x + '" y1="' + a2.y + '" x2="' + b2.x + '" y2="' + b2.y + '" ' + stroke +
        ' stroke-width="1.8" opacity="0.85"/>' + rungs.join("") +
        '<circle cx="' + a.x + '" cy="' + a.y + '" r="2.2" ' + fill + '/>' +
        '<circle cx="' + b.x + '" cy="' + b.y + '" r="2.2" ' + fill + '/>' +
        '</svg>';
    }

    // Snake: an S-shaped body with small fins along it.
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;             // unit normal
    const bow = Math.min(9, len * 0.28);  // how far the body bends
    const w = 5;                     // half-width of the wave
    const q1 = { x: mx + nx * bow, y: my + ny * bow };
    const q2 = { x: mx - nx * bow, y: my - ny * bow };
    const path = "M " + a.x + " " + a.y + " C " + q1.x + " " + q1.y + " " + q2.x + " " + q2.y +
      " " + b.x + " " + b.y;

    const fins = [];
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      const s = (i % 2 ? 1 : -1) * w;
      fins.push('<circle cx="' + (px + nx * s).toFixed(2) + '" cy="' + (py + ny * s).toFixed(2) +
        '" r="1.1" ' + fill + ' opacity="0.8"/>');
    }

    return '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<path d="' + path + '" fill="none" ' + stroke + ' stroke-width="3.2" stroke-linecap="round" opacity="0.92"/>' +
      fins.join("") +
      '<circle cx="' + b.x + '" cy="' + b.y + '" r="2.8" fill="' + color + '"/>' +
      '<circle cx="' + a.x + '" cy="' + a.y + '" r="1.8" fill="' + color + '" opacity="0.7"/>' +
      '</svg>';
  }

  /* ---------- tokens and player rows ---------- */

  function buildTokens() {
    tokensEl.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const token = document.createElement("div");
      token.className = "token off";
      token.id = "t" + (i + 1);
      token.textContent = String(i + 1);
      tokensEl.appendChild(token);
    }
  }

  function renderTokens() {
    players.forEach(function (player, i) {
      const token = document.getElementById("t" + (i + 1));
      if (!token) return;
      token.className = "token " + PLAYER_COLORS[i % PLAYER_COLORS.length];
      token.textContent = String(i + 1);
      if (player.pos === 0) {
        token.classList.add("off");
        return;
      }
      token.classList.remove("off");
      const cell = boardEl.querySelector('.cell[data-n="' + player.pos + '"]');
      const area = tokensEl.getBoundingClientRect();
      const rect = cell ? cell.getBoundingClientRect() : area;
      const x = ((rect.left + rect.width / 2) - area.left) / area.width;
      const y = ((rect.top + rect.height / 2) - area.top) / area.height;
      const offset = (i % 2) * 2.4;  // nudge so stacked tokens are both visible
      token.style.left = "calc(" + (x * 100).toFixed(3) + "% + " + offset + "%)";
      token.style.top = "calc(" + (y * 100).toFixed(3) + "% + " + offset + "%)";
    });
  }

  function buildPlayerRows() {
    const box = document.getElementById("playerRows");
    box.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const row = document.createElement("div");
      row.className = "player" + (i === 0 ? " active" : "");
      row.id = "row" + (i + 1);
      row.innerHTML = '<span class="dot ' + PLAYER_COLORS[i] + '"></span>' +
        '<input class="pname" type="text" id="name' + (i + 1) + '" maxlength="16" ' +
        'autocomplete="off" spellcheck="false" aria-label="Name for player ' + (i + 1) + '" />' +
        '<span class="pos" id="pos' + (i + 1) + '">at 0</span>';
      box.appendChild(row);

      const nameInput = row.querySelector(".pname");
      nameInput.addEventListener("focus", function () { nameInput.select(); });
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          nameInput.blur();             // blurring saves the name
        } else if (e.key === "Escape") {
          e.preventDefault();
          nameInput.value = nameOf(i);  // put the old name back
          nameInput.blur();
        }
      });
      nameInput.addEventListener("change", function () { commitName(i, nameInput.value); });
      nameInput.addEventListener("blur", function () { commitName(i, nameInput.value); });
    }
  }

  function renderPanels() {
    players.forEach(function (player, i) {
      const row = document.getElementById("row" + (i + 1));
      if (!row) return;
      row.style.display = "";
      row.classList.toggle("active", i === turn && winner === -1);
      const nameEl = row.querySelector(".pname");
      if (nameEl) {
        // Never overwrite a name while the player is typing in it.
        if (document.activeElement !== nameEl) nameEl.value = nameOf(i);
      }
      document.getElementById("pos" + (i + 1)).textContent = "at " + player.pos;
    });
    for (let i = players.length; i < 4; i++) {
      const row = document.getElementById("row" + (i + 1));
      if (row) row.style.display = "none";
    }
    addBtn.disabled = players.length >= 4;
    if (removeBtn) removeBtn.disabled = players.length <= 2;
  }

  /* ---------- dice ---------- */

  const PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };

  function setDice(value) {
    const pips = diceEl.querySelectorAll(".pip");
    pips.forEach(function (pip, i) {
      pip.classList.toggle("on", (PIPS[value] || []).indexOf(i) !== -1);
    });
    diceEl.setAttribute("aria-label", "Dice showing " + value);
  }

  function msg(html) { msgEl.innerHTML = html; }

  /** Keeps the "whose turn is it" banner above the board in sync. */
  function renderTurn() {
    if (!turnBanner) return;
    const player = players[turn];
    if (turnDot) {
      turnDot.className = "turn-dot " + (player && player.ai ? "p2" : PLAYER_COLORS[turn % PLAYER_COLORS.length]);
    }
    if (turnText) {
      turnText.textContent = winner !== -1
        ? "Game over"
        : (player && player.ai ? "Computer's turn" : nameOf(turn) + "'s turn");
    }
    turnBanner.classList.toggle("over", winner !== -1);
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- the game loop ---------- */

  function newGame(count) {
    players = [];
    // `sixes` is the player's own count of consecutive sixes, so it has to
    // travel with the player instead of living in a shared variable.
    for (let i = 0; i < count; i++) players.push({ pos: 0, sixes: 0, ai: false });
    // In "vs computer" mode player 2 is played by the computer.
    if (mode === "ai" && players.length >= 2) players[1].ai = true;

    turn = 0;
    winner = -1;
    rolling = false;
    moves = 0;
    maxPos = 0;
    startedAt = Date.now();

    rollBtn.disabled = false;
    setDice(1);
    diceLabel.textContent = "Roll to play";

    buildTokens();
    buildPlayerRows();
    buildBoard();
    renderTokens();
    renderPanels();
    renderTurn();
    msg("<b>" + nameOf(0) + "</b>, you're up! Roll the dice to begin.");
  }

  function startTurn() {
    msg("<b>" + nameOf(turn) + "</b> — roll the dice.");
    rollBtn.disabled = false;
    diceLabel.textContent = nameOf(turn) + "'s turn";
    renderTurn();
  }

  async function roll() {
    if (rolling || winner !== -1) return;
    rolling = true;
    rollBtn.disabled = true;
    diceEl.classList.add("rolling");
    diceLabel.textContent = "Rolling…";
    moves++;

    const value = challengeRoll();

    // Brief shuffle animation before the result appears.
    for (let i = 0; i < 6; i++) {
      setDice(1 + Math.floor(Math.random() * 6));
      await sleep(90);
    }
    diceEl.classList.remove("rolling");
    setDice(value);
    Fx.play("dice");

    const player = players[turn];
    if (player.pos > maxPos) maxPos = player.pos;

    // Rules come from the shared, unit-tested rules.js module.
    const result = Rules.step(player, value);
    player.sixes = result.sixes;

    if (result.tripleSix) {
      player.pos = result.pos;
      renderTokens();
      renderPanels();
      flashCell(result.pos);
      Fx.play("tripleSix");
      Fx.toast("<b>Three 6s in a row!</b> " + nameOf(turn) + " is back to square 1.", { kind: "bad" });
      Rewards.unlock("lucky-six");
      await sleep(700);
      nextTurn();
      return;
    }

    if (result.overshoot) {
      Fx.play("click");
      msg("<b>" + nameOf(turn) + "</b> rolled " + value + " — needs an exact " + TOTAL + ". Turn passes.");
      await sleep(700);
      nextTurn();
      return;
    }

    // Walk the token one square at a time.
    for (let i = 0; i < value; i++) {
      player.pos++;
      if (player.pos > maxPos) {
        maxPos = player.pos;
        Rewards.setBest(maxPos);
      }
      renderTokens();
      renderPanels();
      await sleep(180);
    }

    // Resolve ladder / snake jumps.
    let jumped = false;
    for (const jump of result.jumps) {
      const isLadder = jump.to > jump.from;
      msg(isLadder
        ? "<b>" + nameOf(turn) + "</b> climbed the ladder from " + jump.from + " to " + jump.to + "!"
        : "<b>" + nameOf(turn) + "</b> hit a snake at " + jump.from + " — sliding to " + jump.to + "!");
      flashCell(jump.from);
      if (isLadder) {
        Fx.play("ladder");
        if (jump.from === 28 && jump.to === 84) Rewards.unlock("big-ladder");
      } else {
        Fx.play("snake");
      }
      await sleep(550);
      player.pos = jump.to;
      renderTokens();
      renderPanels();
      jumped = true;
      await sleep(550);
    }

    if (!jumped) {
      msg("<b>" + nameOf(turn) + "</b> landed on " + player.pos + ".");
      await sleep(450);
    }

    if (result.won) {
      winner = turn;
      if (player.pos > maxPos) maxPos = player.pos;
      msg("🎉 <b>" + nameOf(turn) + "</b> wins! Reaching square " + TOTAL + ".");
      diceLabel.textContent = "Game over";
      renderPanels();
      renderTurn();
      rolling = false;
      recordGame();
      showWinOverlay();
      return;
    }

    if (result.bonus) {
      msg("<b>" + nameOf(turn) + "</b> rolled a 6 — bonus turn!");
      Fx.play("six");
      rolling = false;
      rollBtn.disabled = false;
      renderPanels();
      return;
    }

    await sleep(300);
    nextTurn();
  }

  function nextTurn() {
    turn = (turn + 1) % players.length;
    rolling = false;
    renderPanels();
    startTurn();
    // The computer plays its own turn shortly after the human's.
    if (players[turn] && players[turn].ai) scheduleAiTurn();
  }

  function scheduleAiTurn() {
    rollBtn.disabled = true;
    diceLabel.textContent = "Computer is thinking…";
    setTimeout(async function () {
      if (winner !== -1 || rolling) return;
      await roll();
      // A 6 grants a bonus turn, so the computer rolls again on its own.
      if (winner === -1 && players[turn] && players[turn].ai && !rolling) {
        setTimeout(scheduleAiTurn, 900);
      }
    }, 850);
  }

  /* ---------- the daily challenge ---------- */

  function todayKey() { return Rewards.todayKey(); }

  function startChallenge() {
    const key = todayKey();
    const seed = Rules.hashSeed(key);
    challenge = { seed: seed, rng: Rules.mulberry32(seed), date: key, moves: 0 };

    const banner = document.getElementById("challengeBanner");
    if (banner) banner.classList.add("show");
    const value = document.getElementById("challengeValue");
    if (value) value.textContent = "Challenge on";
    const chip = document.getElementById("challengeStart");
    if (chip) {
      const hint = chip.querySelector("small");
      if (hint) hint.textContent = "Tap to leave the challenge";
    }

    newGame(2);
    msg("<b>Daily Challenge started.</b> Everyone gets the same dice sequence today — good luck!");
  }

  function exitChallenge() {
    challenge = null;
    const banner = document.getElementById("challengeBanner");
    if (banner) banner.classList.remove("show");
    const value = document.getElementById("challengeValue");
    if (value) value.textContent = "Daily challenge";
    const chip = document.getElementById("challengeStart");
    if (chip) {
      const hint = chip.querySelector("small");
      if (hint) hint.textContent = "Same dice for everyone";
    }
    newGame(mode === "ai" ? 2 : (players.length || 2));
  }

  function challengeRoll() {
    if (!challenge) return 1 + Math.floor(Math.random() * 6);
    const value = 1 + Math.floor(challenge.rng() * 6);
    challenge.moves++;
    return value;
  }

  /* ---------- the board explorer ---------- */

  function squareText(n) {
    const square = Rules.describeSquare(n);
    if (square.type === "ladder") {
      return "<b>Ladder</b> — land on square " + n + " and you climb to <b>" + square.to +
        "</b>, " + (square.to - n) + " squares up.";
    }
    if (square.type === "snake") {
      return "<b>Snake</b> — land on square " + n + " and you slide down to <b>" + square.to +
        "</b>, " + (n - square.to) + " squares back.";
    }
    return "Plain square <b>" + n + "</b> — nothing happens when you land here.";
  }

  function showSquare(n) {
    const numEl = document.getElementById("explorerNum");
    const textEl = document.getElementById("explorerText");
    if (numEl) numEl.textContent = String(n);
    if (textEl) textEl.innerHTML = squareText(n);
    const previous = boardEl.querySelector(".cell.explored");
    if (previous) previous.classList.remove("explored");
    const cell = boardEl.querySelector('.cell[data-n="' + n + '"]');
    if (cell) cell.classList.add("explored");
    Rewards.noteSquare(n);
  }

  /* ---------- the win dialog ---------- */

  function recordGame() {
    Rewards.recordGame({
      humanWon: winner === 0,
      mode: mode,
      challenge: Boolean(challenge),
      maxPos: maxPos,
      moves: moves,
      name: nameOf(winner)
    });
  }

  function showWinOverlay() {
    const overlay = document.getElementById("winOverlay");
    if (!overlay) return;
    const computerWon = players[winner] && players[winner].ai;
    document.getElementById("winEmoji").textContent = computerWon ? "🤖" : "🎉";
    document.getElementById("winTitle").textContent = computerWon
      ? "The computer wins!"
      : nameOf(winner) + " wins!";
    document.getElementById("winSub").textContent = challenge
      ? "Daily Challenge " + challenge.date + " — reached square " + TOTAL
      : "Reached square " + TOTAL;
    document.getElementById("winMoves").textContent = String(moves);
    document.getElementById("winTime").textContent =
      Math.max(1, Math.round((Date.now() - startedAt) / 1000)) + "s";
    document.getElementById("winBest").textContent = String(Rewards.best);

    if (window.SiteDialog) window.SiteDialog.open(overlay);
    else overlay.classList.add("show");
  }

  function hideWinOverlay() {
    const overlay = document.getElementById("winOverlay");
    if (!overlay) return;
    if (window.SiteDialog) window.SiteDialog.close(overlay);
    else overlay.classList.remove("show");
  }

  function shareResult() {
    const text = challenge
      ? "I beat today's Snake & Ladder Daily Challenge in " + moves + " rolls! 🐍🎲 Can you beat me?"
      : "I just won a game of Snake & Ladder in " + moves + " rolls! 🐍🎲 Think you can beat me?";
    const url = new URL("index.html", location.href.split("#")[0]);
    if (challenge) url.searchParams.set("challenge", challenge.date);

    if (navigator.share) {
      navigator.share({ title: "Snake & Ladder", text: text, url: url.toString() })
        .catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + " " + url.toString()).then(function () {
        const button = document.getElementById("winShare");
        if (button) {
          button.textContent = "Copied! ✅";
          setTimeout(function () { button.textContent = "Share result"; }, 1800);
        }
      });
    }
  }

  function flashCell(n) {
    const cell = boardEl.querySelector('.cell[data-n="' + n + '"]');
    if (!cell) return;
    cell.classList.add("hit");
    setTimeout(function () { cell.classList.remove("hit"); }, 550);
  }

  /* ---------- the toolbar ---------- */

  function renderModeChip() {
    const label = document.getElementById("modeLabel");
    const chip = document.getElementById("modeToggle");
    if (label) label.textContent = mode === "ai" ? "Vs computer" : "Pass & play";
    if (chip) {
      chip.setAttribute("aria-pressed", mode === "ai" ? "true" : "false");
      const hint = chip.querySelector("small");
      if (hint) hint.textContent = mode === "ai"
        ? "You against the computer"
        : "Everyone shares this device";
    }
  }

  function renderSound() {
    const on = Fx.isEnabled();
    const value = document.getElementById("soundValue");
    if (value) value.textContent = on ? "Sound on" : "Sound off";
    const chip = document.getElementById("soundToggle");
    if (!chip) return;
    chip.setAttribute("aria-pressed", on ? "true" : "false");
    const icon = chip.querySelector(".chip-ico");
    if (icon) icon.textContent = on ? "🔊" : "🔇";
    const hint = chip.querySelector("small");
    if (hint) hint.textContent = on ? "Dice and jingles" : "Tap to turn sound on";
  }

  /* ---------- controls ---------- */

  rollBtn.addEventListener("click", function () { Fx.play("click"); roll(); });
  restartBtn.addEventListener("click", function () { hideWinOverlay(); newGame(players.length); });

  // Adding or removing a player changes the table, not the game that is
  // already in progress - the tokens stay exactly where they are.
  addBtn.addEventListener("click", function () {
    if (players.length >= 4) return;
    hideWinOverlay();
    players.push({ pos: 0, sixes: 0, ai: false });
    buildPlayerRows();
    buildTokens();
    renderTokens();
    renderPanels();
    msg("<b>" + nameOf(players.length - 1) + "</b> joined the game. Roll to continue.");
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      if (players.length <= 2) return;
      hideWinOverlay();
      players.pop();
      if (turn >= players.length) turn = 0;
      buildPlayerRows();
      buildTokens();
      renderTokens();
      renderPanels();
      msg("<b>" + nameOf(players.length) + "</b> left the game. Roll to continue.");
    });
  }

  // "Play vs computer" toggles between two humans sharing a device and a
  // single human against the computer.
  const modeToggle = document.getElementById("modeToggle");
  if (modeToggle) {
    modeToggle.addEventListener("click", function () {
      hideWinOverlay();
      mode = mode === "ai" ? "local" : "ai";
      newGame(2);
      renderModeChip();
      msg(mode === "ai"
        ? "<b>" + nameOf(0) + "</b>, you are up. The computer plays as " + nameOf(1) + "."
        : "<b>Pass &amp; play</b> — everyone shares this device.");
    });
  }

  // The daily challenge chip toggles: tapping it while a challenge is
  // running leaves the challenge.
  const challengeStart = document.getElementById("challengeStart");
  if (challengeStart) {
    challengeStart.addEventListener("click", function () {
      if (challenge) exitChallenge();
      else startChallenge();
    });
  }
  const challengeExit = document.getElementById("challengeExit");
  if (challengeExit) challengeExit.addEventListener("click", exitChallenge);

  const challengeShare = document.getElementById("challengeShare");
  if (challengeShare) {
    challengeShare.addEventListener("click", function () {
      const url = new URL("index.html", location.href.split("#")[0]);
      url.searchParams.set("challenge", challenge ? challenge.date : todayKey());
      const text = "Can you beat today's Snake & Ladder Daily Challenge? 🐍🎲";
      if (navigator.share) {
        navigator.share({ title: "Snake & Ladder Daily Challenge", text: text, url: url.toString() })
          .catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text + " " + url.toString()).then(function () {
          challengeShare.textContent = "Copied! ✅";
          setTimeout(function () { challengeShare.textContent = "Challenge a friend"; }, 1800);
        });
      }
    });
  }

  // Sound on/off, remembered on the device.
  const soundToggle = document.getElementById("soundToggle");
  if (soundToggle) {
    soundToggle.addEventListener("click", function () {
      Fx.toggle();
      renderSound();
    });
  }

  // Board explorer: hovering or tapping a square explains what it does.
  boardEl.addEventListener("mouseover", function (e) {
    const cell = e.target.closest ? e.target.closest(".cell") : null;
    if (cell) showSquare(Number(cell.dataset.n));
  });
  boardEl.addEventListener("click", function (e) {
    const cell = e.target.closest ? e.target.closest(".cell") : null;
    if (cell) {
      showSquare(Number(cell.dataset.n));
      return;
    }
    // Clicking the empty space around the board counts as a roll.
    if (!rolling && winner === -1) roll();
  });

  // Space bar rolls the dice, as long as the player is not typing somewhere
  // or already pressing a button (space activates buttons on its own).
  document.addEventListener("keydown", function (e) {
    // The win dialog swallows Escape and Tab so focus stays inside it.
    const overlay = document.getElementById("winOverlay");
    if (overlay && window.SiteDialog && window.SiteDialog.handleKey(overlay, e)) return;

    const key = e.key === " " || e.key === "Spacebar" ? " " : e.key;
    if (key !== " " && key !== "Enter") return;
    const target = e.target;
    const tag = (target && target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
    // Let the browser handle space/enter when a button or link has focus.
    if (key === " " && (tag === "BUTTON" || tag === "A" || tag === "SUMMARY")) return;
    if (key === "Enter" && tag !== "BODY") return;
    e.preventDefault();
    if (!rolling && winner === -1) roll();
  });

  // Win dialog buttons.
  const winAgain = document.getElementById("winAgain");
  if (winAgain) winAgain.addEventListener("click", function () { hideWinOverlay(); newGame(players.length); });
  const winClose = document.getElementById("winClose");
  if (winClose) winClose.addEventListener("click", hideWinOverlay);
  const winShareBtn = document.getElementById("winShare");
  if (winShareBtn) winShareBtn.addEventListener("click", shareResult);

  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { buildBoard(); renderTokens(); }, 120);
  });

  /* ---------- boot ---------- */

  function openRulesForNewPlayers() {
    if (!rulesBox) return;
    let seen = false;
    try { seen = localStorage.getItem(RULES_SEEN_KEY) === "1"; } catch (e) {}
    if (seen) return;
    rulesBox.open = true;
    try { localStorage.setItem(RULES_SEEN_KEY, "1"); } catch (e) {}
  }

  function boot() {
    const loader = window.Loader;
    if (loader) loader.progress(35, "Loading the rules…");

    Rewards.init();
    renderModeChip();
    renderSound();
    BoardQuiz.init();
    newGame(2);
    openRulesForNewPlayers();

    // ?challenge=YYYY-MM-DD deep-links straight into a daily challenge run.
    let requested = null;
    try { requested = new URLSearchParams(location.search).get("challenge"); } catch (e) {}
    if (requested) {
      const seed = Rules.hashSeed(requested);
      challenge = { seed: seed, rng: Rules.mulberry32(seed), date: requested, moves: 0 };
      const banner = document.getElementById("challengeBanner");
      if (banner) banner.classList.add("show");
      const value = document.getElementById("challengeValue");
      if (value) value.textContent = "Active";
      msg("<b>Daily Challenge " + requested + "</b> — same dice sequence for everyone. Roll to begin.");
    }

    if (loader) {
      loader.progress(70, "Laying out the board…");
      setTimeout(function () { loader.progress(90, "Rolling the dice…"); }, 180);
      setTimeout(function () { loader.done(); }, 620);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();