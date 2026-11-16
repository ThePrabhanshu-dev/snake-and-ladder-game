
(function (root) {
  "use strict";

  const STATS_KEY = "snl-stats-v1";
  const TROPHIES_KEY = "snl-trophies-v1";
  const DAYS_KEY = "snl-days-v1";
  const SEEN_KEY = "snl-seen-v1";

  const TROPHIES = [
    { id: "first-game", emoji: "🎲", name: "First Roll", desc: "Finish your first game" },
    { id: "first-win", emoji: "🏆", name: "First Win", desc: "Win a game" },
    { id: "hat-trick", emoji: "🎖️", name: "Hat-trick", desc: "Win 3 games in a row" },
    { id: "big-ladder", emoji: "🪜", name: "Big Ladder", desc: "Ride the 28 → 84 ladder" },
    { id: "lucky-six", emoji: "6️⃣", name: "Lucky Six", desc: "Roll three 6s in a row" },
    { id: "centurion", emoji: "💯", name: "Centurion", desc: "Reach square 100" },
    { id: "challenger", emoji: "🗓️", name: "Challenger", desc: "Finish a daily challenge" },
    { id: "human", emoji: "🤖", name: "Human vs Machine", desc: "Beat the computer" },
    { id: "quiz-ace", emoji: "🧠", name: "Quiz Ace", desc: "Full marks on the board quiz" },
    { id: "explorer", emoji: "🔍", name: "Board Explorer", desc: "Inspect 10 squares" },
    { id: "veteran", emoji: "🐍", name: "Veteran", desc: "Play 25 games" }
  ];

  const Fx = root.Fx || {
    play: function () {},
    toast: function () {},
    confetti: function () {}
  };

  let stats = { games: 0, wins: 0, streak: 0, best: 0, bestStreak: 0 };
  let trophies = [];
  let days = [];
  let seenSquares = [];

  function readList(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {   }
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) stats = Object.assign(stats, JSON.parse(raw));
    } catch (e) {   }
  }

  function saveStats() {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function unlock(id) {
    if (trophies.indexOf(id) !== -1) return;
    const badge = TROPHIES.filter(function (t) { return t.id === id; })[0];
    if (!badge) return;
    trophies.push(id);
    writeList(TROPHIES_KEY, trophies);
    renderTrophies();
    Fx.play("achievement");
    Fx.toast("🏅 New badge unlocked: <b>" + badge.name + "</b> — " + badge.desc,
      { kind: "trophy", duration: 4200 });
    Fx.confetti({ count: 70, life: 1800 });
  }

  function renderTrophies() {
    const host = document.getElementById("trophyGrid");
    if (!host) return;
    host.innerHTML = "";
    TROPHIES.forEach(function (badge) {
      const got = trophies.indexOf(badge.id) !== -1;
      const el = document.createElement("div");
      el.className = "trophy" + (got ? " unlocked" : "");
      el.innerHTML =
        '<span class="trophy-emoji">' + badge.emoji + "</span>" +
        '<span class="trophy-name">' + badge.name + "</span>" +
        '<span class="trophy-desc">' + (got ? badge.desc : "Locked") + "</span>";
      if (!got) el.setAttribute("aria-label", badge.name + " — locked. " + badge.desc);
      host.appendChild(el);
    });
  }

  function renderStats() {
    const games = document.getElementById("statGames");
    const best = document.getElementById("statBest");
    const streak = document.getElementById("statStreak");
    if (games) games.textContent = String(stats.games);
    if (best) best.textContent = stats.best ? String(stats.best) : "—";
    if (streak) streak.textContent = String(stats.streak);
  }

  function markDay() {
    const key = todayKey();
    if (days.indexOf(key) === -1) {
      days.push(key);
      if (days.length > 90) days = days.slice(-90);
      writeList(DAYS_KEY, days);
    }
  }

  function renderStreak() {
    const host = document.getElementById("streakRow");
    if (!host) return;
    host.innerHTML = "";
    const label = document.createElement("span");
    label.className = "streak-label";
    label.textContent = "Last 7 days";
    host.appendChild(label);
    const now = new Date();
    const names = ["S", "M", "T", "W", "T", "F", "S"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
      const played = days.indexOf(key) !== -1;
      const el = document.createElement("div");
      el.className = "streak-day" + (played ? " on" : "") + (i === 0 ? " today" : "");
      el.textContent = names[d.getDay()];
      el.title = key + (played ? " — played" : " — no game yet");
      host.appendChild(el);
    }
  }

  function recordGame(result) {
    stats.games++;
    if (result.humanWon) {
      stats.wins++;
      stats.streak++;
    } else {
      stats.streak = 0;
    }
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    if (result.maxPos > stats.best) stats.best = result.maxPos;
    saveStats();
    renderStats();
    markDay();

    unlock("first-game");
    if (result.humanWon) {
      unlock("first-win");
      unlock("centurion");
      if (result.challenge) unlock("challenger");
      if (result.mode === "ai") unlock("human");
      if (stats.bestStreak >= 3) unlock("hat-trick");
      Fx.play("win");
      Fx.confetti();
      Fx.toast("🎉 <b>" + result.name + " wins!</b> Reaching square 100 in " +
        result.moves + " rolls.", { kind: "win" });
    } else {
      Fx.play("lose");
    }
    if (stats.games >= 25) unlock("veteran");
    renderTrophies();
    renderStreak();
  }

  function setBest(pos) {
    if (pos > stats.best) {
      stats.best = pos;
      saveStats();
      renderStats();
    }
  }

  function noteSquare(n) {
    if (seenSquares.indexOf(n) === -1) {
      seenSquares.push(n);
      writeList(SEEN_KEY, seenSquares);
      if (seenSquares.length >= 10) unlock("explorer");
    }
  }

  function init() {
    loadStats();
    trophies = readList(TROPHIES_KEY);
    days = readList(DAYS_KEY);
    seenSquares = readList(SEEN_KEY);
    renderStats();
    renderTrophies();
    renderStreak();
  }

  root.Rewards = {
    init: init,
    unlock: unlock,
    noteSquare: noteSquare,
    recordGame: recordGame,
    markDay: markDay,
    setBest: setBest,
    renderStats: renderStats,
    renderTrophies: renderTrophies,
    renderStreak: renderStreak,
    todayKey: todayKey,
    get best() { return stats.best; }
  };
})(window);
