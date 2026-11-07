// Arrive — "how are you arriving?" One tap, one small act, never a menu.
//
// The feeling ring offers a curated closed set; the deterministic map
// picks exactly one act; the model writes only the one-line invitation
// (observational, never interprets the feeling). Acts are gestures that
// end in release — Scatter (draw, then watch it become mist) and
// Set down (pull the weight down slowly). Nothing persists: no saving,
// no streaks, no scores, no ledger writes in v1.

export const FEELINGS = Object.freeze([
  { id: "wired", label: "Wired", act: "scatter" },
  { id: "heavy", label: "Heavy", act: "setdown" },
  { id: "restless", label: "Restless", act: "scatter" },
  { id: "drained", label: "Drained", act: "setdown" },
  { id: "anxious", label: "Anxious", act: "scatter" },
  { id: "foggy", label: "Foggy", act: "setdown" },
  { id: "overwhelmed", label: "Overwhelmed", act: "scatter" },
  { id: "stuck", label: "Stuck", act: "setdown" },
  { id: "okay", label: "Okay", act: null },
]);

export const ACTS = Object.freeze({
  scatter: {
    name: "Scatter",
    hint: "Draw it — anything. It won't stay.",
    cta: "Let it go",
  },
  setdown: {
    name: "Set it down",
    hint: "Press the weight and pull it down — slowly.",
    cta: "Let go",
  },
});

export function feelingById(id) {
  return FEELINGS.find((f) => f.id === id) || null;
}

export function actFor(feelingId) {
  return feelingById(feelingId)?.act ?? null;
}

// --- Invitation line -------------------------------------------------------
//
// One line from Brume, written by the model, observational only. The
// fallback table covers every feeling so the card is never empty when
// the model is absent, slow or filtered.

export const INVITE_MAX_WORDS = 16;
export const INVITE_MAX_CHARS = 110;
export const INVITE_MAX_TOKENS = 60;
export const INVITE_TIMEOUT_MS = 6000;

export const INVITE_FALLBACK = Object.freeze({
  wired: "That wired feeling — draw it and let it go.",
  restless: "Restless? Draw the edges off, then let them go.",
  anxious: "Let the anxious part have the page for a moment.",
  overwhelmed: "Too much at once — put some of it on the page.",
  heavy: "That weight — press it and pull it down, slowly.",
  drained: "Nothing left to give — set the weight down first.",
  foggy: "Unclear is allowed. Set it down and see what's left.",
  stuck: "Stuck has weight too — pull it down, slowly.",
  okay: "Then carry on — Brume's here when you need it.",
});

export function buildInvitePrompt({ feeling, act }) {
  const f = feelingById(feeling);
  const a = act && ACTS[act];
  if (!f) return "";
  if (!a) {
    return [
      `The person answered "How are you arriving?" with: ${f.label}.`,
      "They seem steady — Brume offers no exercise. Write the single short line Brume says back: a calm send-off, not a question, nothing they must answer.",
      `At most ${INVITE_MAX_WORDS} words. Warm, observational, from Brume's side of the room.`,
      "No emoji, no health or outcome claims, never a catalog feeling word back at them.",
    ].join("\n");
  }
  return [
    `The person answered "How are you arriving?" with: ${f.label}.`,
    `Brume offers one small act called "${a.name}": ${a.hint}`,
    "Write the single line Brume says to invite them into it.",
    `At most ${INVITE_MAX_WORDS} words. Warm, observational, from Brume's side of the room — never interpret the feeling, never promise an effect.`,
    "No emoji, no health or outcome claims, no catalog feeling word back at them.",
  ].join("\n");
}

const INVITE_STRIP_RE =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2060\uFEFF\uFE0F\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
const INVITE_CLAIM_RE =
  /\b(will|would|can|could|helps?|helped|calm(?:s|ed|ing)?|relax(?:es|ed|ing)?|fix(?:es|ed)?|cure|heal|reduce[sd]?|lower[sd]?|boost|improve[sd]?|work(?:s|ed)?|effective|benefit|because of|guarantee|promise)\b/i;

// Returns the cleaned line, or null when the model's answer is unusable —
// callers fall back to INVITE_FALLBACK[feeling].
export function cleanInvite(raw, feelingId) {
  if (typeof raw !== "string") return null;
  let text = raw.replace(INVITE_STRIP_RE, " ").replace(/\s+/g, " ").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  const words = text.split(" ").filter(Boolean);
  if (!text || text.length > INVITE_MAX_CHARS) return null;
  if (words.length > INVITE_MAX_WORDS + 4) return null;
  if (INVITE_CLAIM_RE.test(text)) return null;
  const f = feelingById(feelingId);
  if (f && new RegExp(`\\b${f.label}\\b`, "i").test(text)) return null;
  return text;
}

export function inviteFallback(feelingId) {
  return INVITE_FALLBACK[feelingId] || INVITE_FALLBACK.okay;
}

// --- Scatter act -------------------------------------------------------------
//
// A canvas you draw on for as long as you like, then "Let it go": every
// stroke lifts off the page as mist and drifts up. Pure DOM/canvas — no
// storage, no timers that outlive the screen.

// Literal oklch values mirroring brand.css (--brume-cyan / primary ink /
// coral / pear-deep) — canvas fillStyle can't resolve var() at paint time.
const SCATTER_COLORS = [
  "oklch(67% 0.15 235)",
  "oklch(23% 0.018 252)",
  "oklch(67% 0.2 18)",
  "oklch(62% 0.14 95)",
];

export function createScatter({ canvas, onDone, reducedMotion = false }) {
  const ctx = canvas.getContext("2d");
  const strokes = [];
  let current = null;
  let raf = 0;
  let phase = "draw"; // draw | dissolve | done
  let particles = [];
  let dissolveStart = 0;
  const DISSOLVE_MS = reducedMotion ? 350 : 2100;

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function strokeStyle(i) {
    return { color: SCATTER_COLORS[i % SCATTER_COLORS.length], width: 3.2 };
  }

  function redraw() {
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokes.forEach((s, i) => {
      const st = strokeStyle(i);
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      ctx.beginPath();
      s.points.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    });
  }

  function down(e) {
    if (phase !== "draw" || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    current = { points: [toLocal(e)] };
    strokes.push(current);
    redraw();
  }
  function move(e) {
    if (!current || phase !== "draw") return;
    e.preventDefault();
    const p = toLocal(e);
    const last = current.points[current.points.length - 1];
    const dx = p.x - last.x, dy = p.y - last.y;
    if (dx * dx + dy * dy < 4) return;
    current.points.push(p);
    // Incremental segment draw — no full redraw per move.
    const st = strokeStyle(strokes.indexOf(current));
    ctx.strokeStyle = st.color;
    ctx.lineWidth = st.width;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function up() {
    current = null;
  }

  function spawnParticles() {
    const r = canvas.getBoundingClientRect();
    particles = [];
    strokes.forEach((s, si) => {
      const st = strokeStyle(si);
      const step = Math.max(2, Math.floor(s.points.length / 24));
      for (let i = 0; i < s.points.length; i += step) {
        const p = s.points[i];
        particles.push({
          x: p.x, y: p.y,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -(0.45 + Math.random() * 0.75),
          r: 1.6 + Math.random() * 3.4,
          color: st.color,
          life: 0,
        });
      }
    });
    if (!particles.length) particles.push({ x: r.width / 2, y: r.height / 2, vx: 0, vy: -0.8, r: 3, color: SCATTER_COLORS[0], life: 0 });
  }

  function tick(now) {
    if (phase === "draw") return;
    const r = canvas.getBoundingClientRect();
    const t = Math.min(1, (now - dissolveStart) / DISSOLVE_MS);
    ctx.clearRect(0, 0, r.width, r.height);
    if (reducedMotion) {
      // Opacity only: the page fades as one.
      ctx.globalAlpha = 1 - t;
      redraw();
      ctx.globalAlpha = 1;
    } else {
      particles.forEach((p) => {
        p.life = t;
        p.x += p.vx + Math.sin(t * 6 + p.y * 0.05) * 0.15;
        p.y += p.vy * (0.6 + t);
        const a = Math.max(0, 0.5 * (1 - t));
        if (a <= 0 || p.y < -12) return;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + t * 0.8), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      phase = "done";
      onDone?.();
    }
  }

  function key(e) {
    if ((e.key === "Enter" || e.key === " ") && phase === "draw") {
      e.preventDefault();
      letGo();
    }
  }

  function letGo() {
    if (phase !== "draw") return;
    phase = "dissolve";
    current = null;
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    canvas.removeEventListener("keydown", key);
    if (!reducedMotion) spawnParticles();
    dissolveStart = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function destroy() {
    phase = "done";
    cancelAnimationFrame(raf);
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    canvas.removeEventListener("keydown", key);
  }

  size();
  window.addEventListener("resize", size);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("keydown", key);

  return {
    letGo,
    get phase() { return phase; },
    destroy() {
      destroy();
      window.removeEventListener("resize", size);
    },
  };
}

// --- Set down act -------------------------------------------------------------
//
// A weight hangs at the top of a short track. Press it and pull it down —
// slowly. Let go too early and it floats back; let it reach the bottom and
// it lands, and the mist settles. Opacity carries the progress under
// reduced motion instead of travel.

export function createSetdown({ weight, onDone, reducedMotion = false }) {
  const DROP_PX = 150;
  let dragging = false;
  let startY = 0;
  let dy = 0;
  let phase = "ready"; // ready | falling | done
  let fallTimer = 0;

  function progress() {
    return Math.min(1, dy / DROP_PX);
  }

  function paint() {
    const p = progress();
    if (reducedMotion) {
      weight.style.opacity = String(1 - p * 0.85);
      weight.style.transform = "";
    } else {
      weight.style.opacity = "";
      weight.style.transform = `translateY(${dy}px)`;
    }
    weight.style.setProperty("--drop", String(p));
  }

  function down(e) {
    if (phase !== "ready" || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    dragging = true;
    startY = e.clientY;
    weight.setPointerCapture?.(e.pointerId);
    weight.classList.add("held");
  }
  function move(e) {
    if (!dragging || phase !== "ready") return;
    e.preventDefault();
    // Slow resistance — the pull should feel weighted, not elastic.
    dy = Math.max(0, Math.min(DROP_PX * 1.15, (e.clientY - startY) * 0.85));
    paint();
  }
  function succeed() {
    if (phase !== "ready") return;
    phase = "falling";
    const target = DROP_PX * 1.02;
    weight.style.transition = reducedMotion ? "opacity .5s" : "transform .55s cubic-bezier(.5,0,.8,.4), opacity .55s";
    if (reducedMotion) weight.style.opacity = "0";
    else weight.style.transform = `translateY(${target}px)`;
    weight.style.setProperty("--drop", "1");
    fallTimer = setTimeout(() => {
      phase = "done";
      onDone?.();
    }, reducedMotion ? 550 : 620);
  }

  function key(e) {
    if (e.key === "ArrowDown" && phase === "ready" && !e.repeat) {
      e.preventDefault();
      succeed();
    }
  }

  function up() {
    if (!dragging) return;
    dragging = false;
    weight.classList.remove("held");
    if (phase !== "ready") return;
    if (dy >= DROP_PX * 0.72) {
      succeed();
    } else {
      // Floats back — gentler than it left.
      weight.style.transition = reducedMotion ? "opacity .4s" : "transform .5s cubic-bezier(.2,.7,.3,1)";
      dy = 0;
      paint();
      setTimeout(() => { weight.style.transition = ""; }, 520);
    }
  }

  function destroy() {
    phase = "done";
    clearTimeout(fallTimer);
    weight.removeEventListener("pointerdown", down);
    weight.removeEventListener("pointermove", move);
    weight.removeEventListener("pointerup", up);
    weight.removeEventListener("pointercancel", up);
    weight.removeEventListener("keydown", key);
  }

  weight.addEventListener("pointerdown", down);
  weight.addEventListener("pointermove", move);
  weight.addEventListener("pointerup", up);
  weight.addEventListener("pointercancel", up);
  weight.addEventListener("keydown", key);

  return { destroy, get phase() { return phase; } };
}
