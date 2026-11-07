// Arrive — "how are you arriving?" One tap, one small act, never a menu.
//
// The feeling ring offers a curated closed set; the deterministic map
// picks exactly one act; the model writes only the one-line invitation
// (observational, never interprets the feeling). Acts are gestures that
// end in release — Scatter (draw, then watch it erode into rising mist)
// and Set it down (a weight that only travels slowly; rush it and the
// grip slips). Each act is a pure core (testable in node) plus a thin DOM
// adapter. Nothing persists: no saving, no streaks, no scores, no ledger
// writes in v1.

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
    slip: "Slower — let it take its time.",
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
  wired: "Whatever's buzzing — draw it, then let it go.",
  restless: "Put the fidgeting on the page, then let it drift.",
  anxious: "Give the page the racing part for a moment.",
  overwhelmed: "Too much at once — put some of it on the page.",
  heavy: "That weight — press it and pull it down, slowly.",
  drained: "Nothing left to give — set the weight down first.",
  foggy: "Unclear is allowed. Set it down and see what's left.",
  stuck: "Whatever won't move — pull it down, slowly.",
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

// --- Shared helpers ----------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const easeOutCubic = (k) => 1 - (1 - k) ** 3;

// Seeded PRNG (mulberry32): one release always breaks up the same way,
// which keeps the dissolve testable in node.
export function seededRandom(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Canvas paint can't resolve var(); let the browser compute the token.
function resolveRgb(el, css, fallback) {
  try {
    const prev = el.style.color;
    el.style.color = css;
    const out = getComputedStyle(el).color;
    el.style.color = prev;
    const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(out || "");
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : fallback;
  } catch {
    return fallback;
  }
}

// --- Scatter: pure core --------------------------------------------------------
//
// Ink is one colour (the room's primary) and thins as the hand speeds up,
// like a brush. On release the page lifts, then an erosion front rises
// from the bottom of the drawing — mist goes up, so the lowest ink goes
// first — with a smooth ragged edge. Each ink point feathers out just
// before its moment and becomes soft sprites that drift up, swell and
// fade from ink toward the room's mist colour. No confetti, no hard cut.

export const SCATTER = Object.freeze({
  MIN_WIDTH: 2.2,        // px — a fast stroke
  MAX_WIDTH: 7.5,        // px — a slow, pressed stroke
  FAST_PX_PER_MS: 1.4,   // speed at which ink is thinnest
  SAMPLE_PX: 2.5,        // min distance between stored points
  LIFT_S: 0.3,           // the whole page lightens before anything goes
  ERODE_S: 1.5,          // the front's travel time, bottom to top
  EDGE_S: 0.22,          // each segment's feather-out before release
  LIFE_MIN_S: 1.2,
  LIFE_MAX_S: 1.9,
  PER_POINT: 2,
  MAX_PARTICLES: 1400,   // a full page costs the same as a busy one
  PEAK_ALPHA: 0.34,
  TONES: 6,              // pre-tinted sprites along the ink → mist ramp
});

export function inkWidth(speed, prev) {
  const k = clamp((Number(speed) || 0) / SCATTER.FAST_PX_PER_MS, 0, 1);
  const target = SCATTER.MAX_WIDTH - (SCATTER.MAX_WIDTH - SCATTER.MIN_WIDTH) * k;
  return prev == null ? target : prev + (target - prev) * 0.3;
}

export function releaseAt(x, y, height, seed = 0) {
  const h = height > 0 ? height : 1;
  const rise = 1 - clamp(y / h, 0, 1);
  const edge = 0.5 + 0.5 * Math.sin(x * 0.043 + seed) * Math.cos(y * 0.031 - seed * 0.7);
  return SCATTER.LIFT_S + SCATTER.ERODE_S * clamp(0.72 * rise + 0.28 * edge, 0, 1);
}

export function inkAlpha(t, release) {
  const lift = t <= 0 ? 1 : 1 - 0.18 * clamp(t / SCATTER.LIFT_S, 0, 1);
  return lift * clamp((release - t) / SCATTER.EDGE_S, 0, 1);
}

export function mistAlpha(age01) {
  const a = clamp(age01, 0, 1);
  if (a < 0.16) return SCATTER.PEAK_ALPHA * easeOutCubic(a / 0.16);
  const k = (a - 0.16) / 0.84;
  return SCATTER.PEAK_ALPHA * (1 - k) * (1 - k);
}

export function mistRadius(width, age01) {
  return Math.max(1, width) * (0.8 + 3.8 * easeOutCubic(clamp(age01, 0, 1)));
}

export function dissolveSeconds() {
  return SCATTER.LIFT_S + SCATTER.ERODE_S + SCATTER.LIFE_MAX_S;
}

export function planMist(strokes, height, rand, seed = 0) {
  const pts = [];
  for (const s of strokes) for (const p of s.points) pts.push(p);
  const stride = Math.max(1, Math.ceil((pts.length * SCATTER.PER_POINT) / SCATTER.MAX_PARTICLES));
  // Thinned-out ink gets fatter puffs so a dense page still reads as one cloud.
  const fill = 1 + (stride - 1) * 0.35;
  const out = [];
  for (let i = 0; i < pts.length; i += stride) {
    const p = pts[i];
    for (let j = 0; j < SCATTER.PER_POINT; j++) {
      out.push({
        x: p.x + (rand() - 0.5) * p.w,
        y: p.y + (rand() - 0.5) * p.w,
        w: p.w * (0.8 + rand() * 0.6) * fill,
        born: releaseAt(p.x, p.y, height, seed),
        life: SCATTER.LIFE_MIN_S + rand() * (SCATTER.LIFE_MAX_S - SCATTER.LIFE_MIN_S),
        vx: (rand() - 0.5) * 10,
        vy: -(20 + rand() * 26),
        phase: rand() * Math.PI * 2,
        tone: rand() * 0.25,
      });
    }
  }
  return out;
}

// Mist thins out before the page edge so it never reads as clipped by a box.
export function edgeFade(x, y, width, inset = 0, margin = 36) {
  return clamp((Math.min(y, x, width - x) - inset) / margin, 0, 1);
}

// Advance one mist particle by dt seconds at dissolve time t (mutates p).
export function stepMist(p, t, dt) {
  if (t < p.born) return;
  const age = t - p.born;
  p.vy -= 9 * dt;
  const sway = 13 * Math.sin(p.y * 0.024 + age * 1.6 + p.phase);
  p.x += (p.vx + 6 + sway) * dt;
  p.y += p.vy * dt;
}

// --- Scatter: DOM adapter -------------------------------------------------------

function makeSprites(ink, mist) {
  const n = SCATTER.TONES;
  return Array.from({ length: n }, (_, i) => {
    const k = (i / (n - 1)) * 0.72;
    const [r, g, b] = ink.map((c, j) => Math.round(c + (mist[j] - c) * k));
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g2 = c.getContext("2d");
    const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    return c;
  });
}

const KEY_STEP = 9;
const KEY_DIRS = Object.freeze({
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
});

export function createScatter({ canvas, onInk, onRelease, onDone, reducedMotion = false, seed }) {
  const ctx = canvas.getContext("2d");
  const strokes = [];
  let current = null;
  let keyStroke = null;
  let pen = null;
  let phase = "draw"; // draw | dissolve | done
  let inked = false;
  let raf = 0;
  let mist = [];
  let sprites = null;
  let started = 0;
  let last = 0;
  let endAt = 0;
  let cssW = 0;
  let cssH = 0;
  const runSeed = Number.isFinite(seed) ? seed : Date.now() % 100000;
  const rand = seededRandom(runSeed + 1);
  const wave = (runSeed % 628) / 100;
  const ink = resolveRgb(canvas, "hsl(var(--brume-primary))", [48, 55, 96]);
  const mistRgb = resolveRgb(canvas, "rgb(var(--brume-mist-r) var(--brume-mist-g) var(--brume-mist-b))", [233, 224, 184]);
  const inkCss = `rgb(${ink.join(",")})`;

  function size() {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = r.width;
    cssH = r.height;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Resizing wipes the bitmap; the strokes are still the person's to see.
    if (phase === "draw") drawInk(null);
  }

  function segment(a, b, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = inkCss;
    ctx.lineWidth = (a.w + b.w) / 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function dot(p, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = inkCss;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawInk(t, fade = 1) {
    ctx.clearRect(0, 0, cssW, cssH);
    for (const s of strokes) {
      const pts = s.points;
      for (let i = 0; i < pts.length; i++) {
        const b = pts[i];
        if (i === 0) {
          const a0 = (t == null ? 1 : inkAlpha(t, b.r)) * fade;
          if (a0 > 0) dot(b, a0);
          continue;
        }
        const a = pts[i - 1];
        const al = (t == null ? 1 : inkAlpha(t, Math.min(a.r, b.r))) * fade;
        if (al > 0) segment(a, b, al);
      }
    }
    ctx.globalAlpha = 1;
  }

  function addPoint(stroke, p) {
    const pts = stroke.points;
    const prev = pts[pts.length - 1];
    if (prev) {
      const d = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (d < SCATTER.SAMPLE_PX) return;
      const speed = d / Math.max(1, p.t - prev.t);
      const next = { x: p.x, y: p.y, t: p.t, w: inkWidth(speed, prev.w) };
      pts.push(next);
      segment(prev, next, 1);
    } else {
      const first = { x: p.x, y: p.y, t: p.t, w: inkWidth(0.35) };
      pts.push(first);
      dot(first, 1);
    }
    ctx.globalAlpha = 1;
    if (!inked) {
      inked = true;
      onInk?.();
    }
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now() };
  }

  function down(e) {
    if (phase !== "draw" || current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
    current = { points: [], id: e.pointerId };
    strokes.push(current);
    addPoint(current, local(e));
  }

  function move(e) {
    if (!current || phase !== "draw" || e.pointerId !== current.id) return;
    e.preventDefault();
    const list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
    for (const ev of list && list.length ? list : [e]) addPoint(current, local(ev));
  }

  function up(e) {
    if (current && e.pointerId === current.id) current = null;
  }

  function key(e) {
    if (phase !== "draw") return;
    const dir = KEY_DIRS[e.key];
    if (dir) {
      e.preventDefault();
      const t = e.timeStamp || performance.now();
      if (!pen) pen = { x: cssW / 2, y: cssH / 2 };
      if (!keyStroke || strokes[strokes.length - 1] !== keyStroke) {
        keyStroke = { points: [] };
        strokes.push(keyStroke);
        addPoint(keyStroke, { ...pen, t });
      }
      pen = {
        x: clamp(pen.x + dir[0] * KEY_STEP, 4, cssW - 4),
        y: clamp(pen.y + dir[1] * KEY_STEP, 4, cssH - 4),
      };
      addPoint(keyStroke, { ...pen, t });
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      letGo();
    }
  }

  function tick(now) {
    raf = 0;
    if (phase !== "dissolve") return;
    const t = (now - started) / 1000;
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (reducedMotion) {
      // Opacity only: the page fades as one.
      drawInk(null, 1 - clamp(t / endAt, 0, 1));
    } else {
      drawInk(t);
      for (const p of mist) {
        if (t < p.born) continue;
        stepMist(p, t, dt);
        const age = (t - p.born) / p.life;
        if (age >= 1) continue;
        const r = mistRadius(p.w, age);
        const a = mistAlpha(age) * edgeFade(p.x, p.y, cssW, r * 0.6);
        if (a <= 0.003) continue;
        const tone = Math.min(SCATTER.TONES - 1, Math.floor((age * 0.85 + p.tone) * SCATTER.TONES));
        ctx.globalAlpha = a;
        ctx.drawImage(sprites[tone], p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
    if (t >= endAt) {
      ctx.clearRect(0, 0, cssW, cssH);
      phase = "done";
      onDone?.();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function letGo() {
    if (phase !== "draw" || !inked) return false;
    phase = "dissolve";
    current = null;
    for (const s of strokes) for (const p of s.points) p.r = releaseAt(p.x, p.y, cssH, wave);
    if (reducedMotion) {
      mist = [];
      endAt = 0.6;
    } else {
      mist = planMist(strokes, cssH, rand, wave);
      sprites = makeSprites(ink, mistRgb);
      endAt = mist.reduce((m, p) => Math.max(m, p.born + p.life), 0.6);
    }
    started = performance.now();
    last = started;
    onRelease?.();
    raf = requestAnimationFrame(tick);
    return true;
  }

  function destroy() {
    phase = "done";
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener("resize", size);
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    canvas.removeEventListener("keydown", key);
    ctx.clearRect(0, 0, cssW, cssH);
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
    destroy,
    get phase() { return phase; },
    get hasInk() { return inked; },
  };
}

// --- Set it down: pure core ---------------------------------------------------
//
// The weight never travels faster than MAX_SPEED. It chases the finger
// with a lag, so a slow pull feels carried and a rushed one gets ahead
// of it: once the finger leads by SLIP_GAP the grip slips and the
// weight floats back up. Past LAND_AT it finds the ground on its own,
// decelerating — set down, not dropped.

export const SETDOWN = Object.freeze({
  MAX_SPEED: 85,   // px/s
  FOLLOW: 7,       // 1/s — how hard it chases the finger
  GRIP: 10,        // 1/s — how quickly its speed answers
  SLIP_GAP: 68,    // px
  LAND_AT: 0.86,   // share of the drop
  RISE: 2.6,       // 1/s — float-back when let go early
  SETTLE: 5.5,     // 1/s — the soft landing
});

export function setdownStart() {
  return { y: 0, v: 0, phase: "ready" }; // ready | landing | done
}

export function stepSetdown(state, input, dt, drop) {
  const s = { ...state };
  const out = { state: s, slipped: false, landed: false };
  if (s.phase === "done" || !(drop > 0)) return out;
  const h = clamp(Number(dt) || 0, 0, 0.05);
  if (s.phase === "ready" && s.y >= drop * SETDOWN.LAND_AT) s.phase = "landing";
  if (s.phase === "landing") {
    // Carry the arriving speed, then only ever slow: the cap shrinks with
    // the distance left, so the weight eases onto the ground without a lurch.
    s.v = Math.min(Math.max(s.v, 24), Math.max(6, SETDOWN.SETTLE * (drop - s.y)));
    s.y = Math.min(drop, s.y + s.v * h);
    if (s.y >= drop) {
      s.y = drop;
      s.v = 0;
      s.phase = "done";
      out.landed = true;
    }
    return out;
  }
  if (input?.gripped) {
    const lead = (Number(input.targetY) || 0) - s.y;
    if (lead > SETDOWN.SLIP_GAP) {
      out.slipped = true;
    } else {
      const want = clamp(lead * SETDOWN.FOLLOW, -SETDOWN.MAX_SPEED * 1.5, SETDOWN.MAX_SPEED);
      s.v += (want - s.v) * (1 - Math.exp(-SETDOWN.GRIP * h));
      s.y = clamp(s.y + s.v * h, 0, drop);
      if (s.y >= drop * SETDOWN.LAND_AT) s.phase = "landing";
      return out;
    }
  }
  s.v = 0;
  s.y *= Math.exp(-SETDOWN.RISE * h);
  if (s.y < 0.4) s.y = 0;
  return out;
}

// --- Set it down: DOM adapter -----------------------------------------------------
//
// Writes --drop (0..1) and --travel (px) on the track for the CSS ground,
// trail and shadow; the weight itself is transform-only, or opacity-only
// under reduced motion. Keyboard: hold ArrowDown / Space / Enter to lower
// at the same unhurried pace; letting go early floats it back.

const HOLD_KEYS = new Set(["ArrowDown", " ", "Enter"]);

export function createSetdown({ track, weight, onSlip, onDone, reducedMotion = false }) {
  const host = track || weight.parentElement;
  const drop = Math.max(60, host.clientHeight - weight.offsetHeight - 16);
  let state = setdownStart();
  let gripped = false;
  let keyHeld = false;
  let pointerId = null;
  let grabClient = 0;
  let grabY = 0;
  let targetY = 0;
  let squash = 0;
  let raf = 0;
  let last = 0;
  let alive = true;
  host.style.setProperty("--travel", `${drop}px`);
  host.style.setProperty("--drop", "0");
  host.classList.remove("landed");

  function paint() {
    const p = state.y / drop;
    host.style.setProperty("--drop", p.toFixed(3));
    if (reducedMotion) {
      weight.style.transform = "";
      weight.style.opacity = state.phase === "done" ? "" : String(1 - p * 0.6);
    } else {
      const sx = 1 + 0.06 * squash;
      const sy = 1 - 0.06 * squash;
      weight.style.transform = `translate3d(0, ${state.y.toFixed(2)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    }
  }

  function letGoGrip() {
    gripped = false;
    keyHeld = false;
    pointerId = null;
    weight.classList.remove("held");
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
    last = now;
    const held = gripped || keyHeld;
    if (keyHeld) targetY = state.y + SETDOWN.SLIP_GAP * 0.5;
    const r = stepSetdown(state, { gripped: held, targetY }, dt, drop);
    state = r.state;
    if (r.slipped) {
      letGoGrip();
      onSlip?.();
    }
    const want = (gripped || keyHeld) && state.phase === "ready" ? 1 : 0;
    squash += (want - squash) * (1 - Math.exp(-12 * dt));
    if (r.landed) {
      squash = reducedMotion ? 0 : 1.6; // the soft thud, then it rests
      letGoGrip();
      host.classList.add("landed");
      onDone?.();
    }
    paint();
    const busy = gripped || keyHeld || state.phase === "landing" || state.y > 0 || Math.abs(squash) > 0.01;
    if (busy) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  function kick() {
    if (!raf && alive) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function down(e) {
    if (state.phase !== "ready" || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    gripped = true;
    pointerId = e.pointerId;
    grabClient = e.clientY;
    grabY = state.y;
    targetY = state.y;
    try { weight.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
    weight.classList.add("held");
    kick();
  }

  function move(e) {
    if (!gripped || e.pointerId !== pointerId) return;
    e.preventDefault();
    targetY = grabY + (e.clientY - grabClient);
  }

  function up(e) {
    if (pointerId !== null && e.pointerId !== pointerId) return;
    if (!gripped) return;
    letGoGrip();
    kick();
  }

  function keydown(e) {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();
    if (state.phase !== "ready" || keyHeld) return;
    keyHeld = true;
    weight.classList.add("held");
    kick();
  }

  function keyup(e) {
    if (!HOLD_KEYS.has(e.key) || !keyHeld) return;
    keyHeld = false;
    weight.classList.remove("held");
    kick();
  }

  function blur() {
    if (!keyHeld) return;
    keyHeld = false;
    weight.classList.remove("held");
    kick();
  }

  function destroy() {
    alive = false;
    cancelAnimationFrame(raf);
    raf = 0;
    weight.removeEventListener("pointerdown", down);
    weight.removeEventListener("pointermove", move);
    weight.removeEventListener("pointerup", up);
    weight.removeEventListener("pointercancel", up);
    weight.removeEventListener("keydown", keydown);
    weight.removeEventListener("keyup", keyup);
    weight.removeEventListener("blur", blur);
    weight.classList.remove("held");
  }

  weight.addEventListener("pointerdown", down);
  weight.addEventListener("pointermove", move);
  weight.addEventListener("pointerup", up);
  weight.addEventListener("pointercancel", up);
  weight.addEventListener("keydown", keydown);
  weight.addEventListener("keyup", keyup);
  weight.addEventListener("blur", blur);
  paint();

  return {
    destroy,
    get phase() { return state.phase; },
    get progress() { return state.y / drop; },
  };
}
