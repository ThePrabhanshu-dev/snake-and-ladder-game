/* Snake & Ladder — sound effects, confetti and toasts.
 * Everything is synthesised with the Web Audio API, so the site ships no
 * extra media files. Sound is opt-out and remembered on the device.
 */
(function (root) {
  "use strict";

  const KEY = "snl-fx-v1";
  const doc = root.document;

  let enabled = true;
  try {
    const raw = root.localStorage.getItem(KEY);
    if (raw !== null) enabled = raw === "1";
  } catch (e) { /* storage blocked — keep the default */ }

  let ctx = null;
  function audio() {
    if (!enabled) return null;
    try {
      if (!ctx) {
        const Ctor = root.AudioContext || root.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  /** One shaped oscillator note. */
  function note(freq, dur, opts) {
    const o = opts || {};
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);

    const peak = o.gain === undefined ? 0.18 : o.gain;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Short filtered noise burst — used for the dice rattle. */
  function noise(dur, opts) {
    const o = opts || {};
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const frames = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = o.freq || 1400;
    filter.Q.value = o.q || 1.1;
    const gain = ac.createGain();
    gain.gain.value = o.gain === undefined ? 0.12 : o.gain;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t0);
  }

  const SOUNDS = {
    click: function () { note(520, 0.07, { type: "triangle", gain: 0.09 }); },
    dice: function () {
      noise(0.16, { freq: 1500, gain: 0.1 });
      noise(0.14, { freq: 1100, gain: 0.09, delay: 0.13 });
      note(240, 0.12, { type: "square", gain: 0.05, delay: 0.24 });
    },
    step: function () { note(330 + Math.random() * 40, 0.06, { type: "sine", gain: 0.06 }); },
    ladder: function () {
      [523, 659, 784, 1047].forEach((f, i) =>
        note(f, 0.16, { type: "triangle", gain: 0.13, delay: i * 0.075 }));
    },
    snake: function () {
      note(420, 0.34, { type: "sawtooth", to: 110, gain: 0.11 });
      noise(0.24, { freq: 700, gain: 0.05, delay: 0.05 });
    },
    six: function () { note(880, 0.13, { type: "square", gain: 0.1 }); note(1175, 0.14, { type: "square", gain: 0.08, delay: 0.09 }); },
    tripleSix: function () {
      [392, 330, 262, 196].forEach((f, i) =>
        note(f, 0.22, { type: "sawtooth", gain: 0.1, delay: i * 0.11 }));
    },
    win: function () {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        note(f, 0.3, { type: "triangle", gain: 0.15, delay: i * 0.1 }));
      note(1568, 0.6, { type: "sine", gain: 0.1, delay: 0.5 });
    },
    lose: function () { [392, 330, 262].forEach((f, i) => note(f, 0.26, { type: "triangle", gain: 0.1, delay: i * 0.13 })); },
    achievement: function () {
      [784, 988, 1175, 1568].forEach((f, i) =>
        note(f, 0.22, { type: "triangle", gain: 0.13, delay: i * 0.09 }));
    },
    quizRight: function () { note(880, 0.12, { type: "sine", gain: 0.13 }); note(1319, 0.16, { type: "sine", gain: 0.11, delay: 0.1 }); },
    quizWrong: function () { note(300, 0.22, { type: "sine", to: 180, gain: 0.11 }); }
  };

  function play(name) {
    if (!enabled) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try { fn(); } catch (e) { /* audio is a nicety, never break the game */ }
  }

  /* ---------- toasts ---------- */
  function toast(text, opts) {
    const o = opts || {};
    if (!doc || !doc.body) return;
    let host = doc.getElementById("toastHost");
    if (!host) {
      host = doc.createElement("div");
      host.id = "toastHost";
      host.className = "toast-host";
      doc.body.appendChild(host);
    }
    const el = doc.createElement("div");
    el.className = "toast" + (o.kind ? " " + o.kind : "");
    el.innerHTML = text;
    host.appendChild(el);
    root.setTimeout(() => {
      el.classList.add("out");
      root.setTimeout(() => el.remove(), 400);
    }, o.duration || 3200);
  }

  /* ---------- confetti ---------- */
  function reducedMotion() {
    try {
      return root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  let confettiCanvas = null;
  let confettiFrame = 0;

  function confetti(opts) {
    const o = opts || {};
    if (!doc || !doc.body || reducedMotion()) return;

    // One canvas at a time — a burst restarts the previous one instead of
    // stacking overlays on top of each other.
    if (!confettiCanvas || !confettiCanvas.isConnected) {
      confettiCanvas = doc.createElement("canvas");
      confettiCanvas.className = "confetti-canvas";
      doc.body.appendChild(confettiCanvas);
    }
    if (confettiFrame) cancelAnimationFrame(confettiFrame);

    const canvas = confettiCanvas;
    const dpr = root.devicePixelRatio || 1;
    const w = root.innerWidth, h = root.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    const ctx2d = canvas.getContext("2d");
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.scale(dpr, dpr);

    const colors = o.colors || ["#5b8cff", "#3ddc97", "#ffd166", "#ff5f6d", "#c08bff", "#4cc9f0"];
    const count = o.count || 140;
    const bits = [];
    for (let i = 0; i < count; i++) {
      bits.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.5,
        y: -20 - Math.random() * h * 0.35,
        r: 4 + Math.random() * 5,
        vx: (Math.random() - 0.5) * 3.4,
        vy: 2.2 + Math.random() * 3.6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.28,
        color: colors[i % colors.length],
        w: 6 + Math.random() * 5,
        h: 9 + Math.random() * 7
      });
    }
    const started = root.performance ? root.performance.now() : Date.now();
    const life = o.life || 2600;

    function frame(now) {
      const t = now - started;
      ctx2d.clearRect(0, 0, w, h);
      for (const b of bits) {
        b.x += b.vx; b.y += b.vy; b.vy += 0.045; b.rot += b.vr;
        ctx2d.save();
        ctx2d.translate(b.x, b.y);
        ctx2d.rotate(b.rot);
        ctx2d.fillStyle = b.color;
        ctx2d.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx2d.restore();
      }
      if (t < life) {
        confettiFrame = root.requestAnimationFrame(frame);
      } else {
        confettiFrame = 0;
        ctx2d.clearRect(0, 0, w, h);
        canvas.remove();
        confettiCanvas = null;
      }
    }
    confettiFrame = root.requestAnimationFrame(frame);
  }

  function setEnabled(on) {
    enabled = !!on;
    try { root.localStorage.setItem(KEY, enabled ? "1" : "0"); } catch (e) {}
    if (enabled) play("click");
    return enabled;
  }

  root.Fx = {
    play: play,
    toast: toast,
    confetti: confetti,
    isEnabled: function () { return enabled; },
    setEnabled: setEnabled,
    toggle: function () { return setEnabled(!enabled); }
  };
})(typeof window !== "undefined" ? window : this);
