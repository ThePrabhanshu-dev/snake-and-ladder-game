/* Interactive loading screen for the Snake & Ladder game.
   Shows a live board build-up, a rolling dice and a progress bar while the
   game assets/rules finish loading. Hides itself once the game is ready. */
(function () {
  "use strict";

  const overlay = document.getElementById("loader");
  if (!overlay) return;

  const bar = document.getElementById("loaderBar");
  const statusEl = document.getElementById("loaderStatus");
  const tipEl = document.getElementById("loaderTip");
  const skipBtn = document.getElementById("loaderSkip");
  const diceEl = document.getElementById("loaderDice");
  const ladderEl = document.getElementById("loaderLadder");
  const snakeEl = document.getElementById("loaderSnake");
  const canvas = document.getElementById("loaderCanvas");

  const TIPS = [
    "Roll a 6 to roll again â€” that's a free extra turn.",
    "Land on a ladder base to climb straight to the top.",
    "Snakes slide you down, so land past them, not on them.",
    "You need an exact 100 to win. Don't overshoot!",
    "Three 6s in a row and you're back to the start.",
    "Climb the long ladder at 28 to jump all the way to 84!",
    "Squares 93, 95 and 87 are snake heads. Stay away.",
    "With 3 or 4 players this game gets seriously competitive."
  ];

  let tipIndex = Math.floor(Math.random() * TIPS.length);
  tipEl.textContent = "Tip: " + TIPS[tipIndex];

  const tipTimer = setInterval(() => {
    tipIndex = (tipIndex + 1) % TIPS.length;
    tipEl.style.opacity = "0";
    setTimeout(() => {
      tipEl.textContent = "Tip: " + TIPS[tipIndex];
      tipEl.style.opacity = "1";
    }, 260);
  }, 3600);

  /* ---------- animated backdrop ---------- */
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext("2d");
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const motes = [];
    for (let i = 0; i < 34; i++) {
      motes.push({
        x: Math.random(), y: Math.random(),
        r: 1 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 0.0009,
        vy: -(0.0004 + Math.random() * 0.0011),
        a: 0.15 + Math.random() * 0.45
      });
    }
    function draw() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += m.vx; m.y += m.vy;
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
        if (m.x < -0.05) m.x = 1.05;
        if (m.x > 1.05) m.x = -0.05;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(140,175,255," + m.a + ")";
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ---------- dice pip helper ---------- */
  const PIP_MAP = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };
  function setLoaderDice(value) {
    if (!diceEl) return;
    diceEl.querySelectorAll(".pip").forEach((p, i) => {
      p.classList.toggle("on", (PIP_MAP[value] || []).includes(i));
    });
  }

  /* ---------- progress ---------- */
  let progress = 0;
  let target = 0;
  let raf = null;

  function tick() {
    progress += (target - progress) * 0.12;
    if (bar) bar.style.width = Math.min(100, progress).toFixed(1) + "%";
    if (Math.abs(target - progress) > 0.4) raf = requestAnimationFrame(tick);
    else { progress = target; if (bar) bar.style.width = target + "%"; raf = null; }
  }
  function animateTo(v) {
    target = Math.max(target, Math.min(100, v));
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /* ---------- self-running demo animation ---------- */
  let demoValue = 1;
  const demoTimer = setInterval(() => {
    demoValue = (demoValue % 6) + 1;
    setLoaderDice(demoValue);
  }, 260);
  overlay.classList.add("show");

  // preload the decorative art
  [ladderEl, snakeEl].forEach(el => { if (el) el.classList.add("animate"); });

  /* ---------- public API ---------- */
  window.Loader = {
    /** Report progress. `label` is shown under the bar. */
    progress(pct, label) {
      animateTo(pct);
      if (label && statusEl) {
        statusEl.textContent = label;
        statusEl.classList.remove("bump");
        void statusEl.offsetWidth;
        statusEl.classList.add("bump");
      }
    },
    /** Finish loading and reveal the game. */
    done() {
      clearInterval(demoTimer);
      clearInterval(tipTimer);
      animateTo(100);
      if (statusEl) statusEl.textContent = "Ready to roll!";
      setTimeout(() => {
        overlay.classList.add("done");
        document.body.classList.add("loaded");
        setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 700);
      }, 320);
    }
  };

  // Skip button jumps straight to the game.
  if (skipBtn) {
    skipBtn.addEventListener("click", () => window.Loader.done());
  }
})();
