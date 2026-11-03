/**
 * Brume mascot engine — pure, clock-free: sampleMascot(t) is fully
 * deterministic, so pausing, resuming and tests produce the same image.
 *
 * Behaviour notes, the bloub way (constants are choices with reasons):
 * - At rest the body almost never bobs. The life at idle is gaze
 *   drift, deterministic micro look-aways, and blinking — not a whole
 *   root on a metronome (the old -1.5/-1.0 bob exaggerated passivity).
 * - Reactions are three-act: anticipation (weight gathering) →
 *   strike (apex) → settle (touchdown squash), never naked sin().
 * - States now differ in silhouette, not just open/dy/lid/mouth: each
 *   default body primitive takes a per-state {sx, sy, dy} delta
 *   (BODY_POSES) — the shape puffs on topup, elongates on stretch,
 *   droops on sleepy.
 * - Transitions blend the whole pose (including silhouette keys)
 *   from a frozen displayed pose over 0.5s, easeOutQuint.
 */
export const MASCOT_STATES = Object.freeze([
  "idle",
  "thinking",
  "inhale",
  "topup",
  "hold",
  "exhale",
  "proud",
  "sleepy",
  "bright",
  "stretch",
  "hum",
  "watching",
  "tender",
]);

const VIEWBOX = 100;
const MAX_BODY_PRIMS = 32;
const MAX_MOUTH_LEN = 512;
const MOUTH_PATH_RE = /^[MmLlHhVvCcQqZz0-9eE+\-., \t]+$/;
const ELLIPSE_KEYS = new Set(["type", "cx", "cy", "rx", "ry", "opacity"]);
const CIRCLE_KEYS = new Set(["type", "cx", "cy", "r", "opacity"]);
const ROOT_KEYS = ["version", "body", "highlight", "eyes", "mouths"];
const EYE_KEYS = ["leftX", "rightX", "y", "rx", "ry"];
const MOUTH_KEYS = ["closed", "smile", "open", "flat"];
const PATH_ARITY = { M: 2, m: 2, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1, C: 6, c: 6, Q: 4, q: 4, Z: 0, z: 0 };
const PATH_TOKEN_RE = /[MmLlHhVvCcQqZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

export const BRUME_AVATAR = Object.freeze({
  version: 1,
  // Cloud blob: main body plus two smaller lobes on top.
  body: Object.freeze([
    Object.freeze({ type: "ellipse", cx: 50, cy: 58, rx: 30, ry: 26 }),
    Object.freeze({ type: "circle", cx: 38, cy: 38, r: 14 }),
    Object.freeze({ type: "circle", cx: 58, cy: 34, r: 17 }),
  ]),
  highlight: Object.freeze({ type: "ellipse", cx: 56, cy: 30, rx: 8, ry: 5, opacity: 0.8 }),
  eyes: Object.freeze({ leftX: 41, rightX: 59, y: 52, rx: 3.2, ry: 4 }),
  mouths: Object.freeze({
    closed: "M 44 60 Q 50 63 56 60 Q 50 63 44 60 Z",
    smile: "M 43 58 Q 50 65 57 58 Q 50 65 43 58 Z",
    open: "M 47 59 Q 50 63 53 59 Q 50 65 47 59 Z",
    flat: "M 45 61 Q 50 61 55 61 Q 50 61 45 61 Z",
  }),
});

function isFiniteNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function validatePrimitive(value, where, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${where}: expected a primitive object`);
    return;
  }
  if (value.type !== "ellipse" && value.type !== "circle") {
    errors.push(`${where}.type: expected "ellipse" or "circle"`);
    return;
  }
  const allowed = value.type === "ellipse" ? ELLIPSE_KEYS : CIRCLE_KEYS;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${where}.${key}: unknown key`);
    else if (key !== "type" && !isFiniteNum(value[key])) {
      errors.push(`${where}.${key}: expected a finite number`);
    }
  }
  if (!isFiniteNum(value.cx) || !isFiniteNum(value.cy)) {
    errors.push(`${where}: cx/cy required`);
    return;
  }
  const extX = value.type === "ellipse" ? value.rx : value.r;
  const extY = value.type === "ellipse" ? value.ry : value.r;
  for (const [k, v] of [["rx or r", extX], ["ry or r", extY]]) {
    if (!isFiniteNum(v) || v <= 0 || v > VIEWBOX / 2) {
      errors.push(`${where}: expected a positive radius within the viewBox`);
    }
  }
  if (isFiniteNum(extX) && isFiniteNum(extY)
      && (value.cx - extX < 0 || value.cx + extX > VIEWBOX
        || value.cy - extY < 0 || value.cy + extY > VIEWBOX)) {
    errors.push(`${where}: shape outside 0..${VIEWBOX} viewBox`);
  }
  if ("opacity" in value && (value.opacity < 0 || value.opacity > 1)) {
    errors.push(`${where}.opacity: expected 0..1`);
  }
}

function validMouthPath(d) {
  if (typeof d !== "string" || d.length === 0 || d.length > MAX_MOUTH_LEN) return false;
  if (!MOUTH_PATH_RE.test(d)) return false;
  const tokens = d.match(PATH_TOKEN_RE) || [];
  if (tokens.join("").length !== d.replace(/[\s,]+/g, "").length) return false;
  let i = 0;
  let first = true;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (!(cmd in PATH_ARITY)) return false;
    if (first && cmd !== "M" && cmd !== "m") return false;
    const arity = PATH_ARITY[cmd];
    i += 1;
    if (arity === 0) {
      first = false;
      continue;
    }
    if (i >= tokens.length || tokens[i] in PATH_ARITY) return false;
    let groups = 0;
    while (i + arity <= tokens.length && !(tokens[i] in PATH_ARITY)) {
      const nums = tokens.slice(i, i + arity).map(Number);
      if (!nums.every(Number.isFinite)) return false;
      i += arity;
      groups += 1;
    }
    if (groups === 0) return false;
    if (i < tokens.length && !(tokens[i] in PATH_ARITY)) return false;
    first = false;
  }
  return !first;
}

export function validateAvatar(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["avatar: expected an object"] };
  }
  for (const key of Object.keys(value)) {
    if (!ROOT_KEYS.includes(key)) errors.push(`avatar.${key}: unknown key`);
  }
  for (const key of ROOT_KEYS) {
    if (!(key in value)) errors.push(`avatar.${key}: missing`);
  }
  if (errors.length) return { ok: false, errors };

  if (value.version !== 1) errors.push("avatar.version: expected 1");

  if (!Array.isArray(value.body) || value.body.length === 0
      || value.body.length > MAX_BODY_PRIMS) {
    errors.push(`avatar.body: expected 1..${MAX_BODY_PRIMS} primitives`);
  } else {
    value.body.forEach((p, i) => validatePrimitive(p, `avatar.body[${i}]`, errors));
  }
  validatePrimitive(value.highlight, "avatar.highlight", errors);

  const eyes = value.eyes;
  if (!eyes || typeof eyes !== "object" || Array.isArray(eyes)) {
    errors.push("avatar.eyes: expected an object");
  } else {
    for (const key of Object.keys(eyes)) {
      if (!EYE_KEYS.includes(key)) errors.push(`avatar.eyes.${key}: unknown key`);
    }
    for (const key of EYE_KEYS) {
      if (!isFiniteNum(eyes[key])) errors.push(`avatar.eyes.${key}: expected a finite number`);
    }
    if (isFiniteNum(eyes.rx) && isFiniteNum(eyes.ry) && isFiniteNum(eyes.leftX)
        && isFiniteNum(eyes.rightX) && isFiniteNum(eyes.y)) {
      if (eyes.rx <= 0 || eyes.ry <= 0) errors.push("avatar.eyes: radii must be positive");
      if (eyes.leftX - eyes.rx < 0 || eyes.rightX + eyes.rx > VIEWBOX
          || eyes.y - eyes.ry < 0 || eyes.y + eyes.ry > VIEWBOX) {
        errors.push("avatar.eyes: geometry outside the viewBox");
      }
      if (eyes.leftX >= eyes.rightX) errors.push("avatar.eyes: leftX must be left of rightX");
    }
  }

  const mouths = value.mouths;
  if (!mouths || typeof mouths !== "object" || Array.isArray(mouths)) {
    errors.push("avatar.mouths: expected an object");
  } else {
    for (const key of Object.keys(mouths)) {
      if (!MOUTH_KEYS.includes(key)) errors.push(`avatar.mouths.${key}: unknown key`);
    }
    for (const key of MOUTH_KEYS) {
      if (!validMouthPath(mouths[key])) {
        errors.push(`avatar.mouths.${key}: expected a valid path data string`);
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

const EXPRESSIONS = Object.freeze({
  idle:      { open: 1,    dy: 0,   lid: 0,   mouth: "closed" },
  thinking:  { open: 1,    dy: -2,  lid: 0,   mouth: "flat" },
  inhale:    { open: 1,    dy: 0,   lid: 0,   mouth: "open" },
  topup:     { open: 1,    dy: 0,   lid: 0,   mouth: "open" },
  hold:      { open: 0.12, dy: 0,   lid: 0,   mouth: "closed" },
  exhale:    { open: 0.35, dy: 0,   lid: 0,   mouth: "closed" },
  proud:     { open: 0.35, dy: 0,   lid: 0,   mouth: "smile" },
  sleepy:    { open: 1,    dy: 1.5, lid: 0.6, mouth: "closed" },
  bright:    { open: 1.25, dy: 0,   lid: 0,   mouth: "smile" },
  stretch:   { open: 1.1,  dy: 0,   lid: 0,   mouth: "smile" },
  hum:       { open: 0.4,  dy: 0,   lid: 0,   mouth: "flat" },
  watching:  { open: 1.2,  dy: 0,   lid: 0,   mouth: "flat" },
  tender:    { open: 0.85, dy: 0.9, lid: 0.3, mouth: "smile" },
});

const BLINK_PERIOD = 20;
const BLINK_TIMES = [4.8, 10.4, 17.2];
const BLINK_HALF = 0.14;

const GAZE_MAX_X = 2.4;
const GAZE_MAX_Y = 1.8;
const IDLE_SLEEP_AFTER = 120;
const IDLE_SLEEP_FADE = 60;

// Deterministic micro look-aways: every LOOK_PERIOD seconds the gaze
// glances at a fresh direction for the window, easing in and out —
// the "alive glance". Seeded per window so pause/resume and tests
// repeat exactly.
const LOOK_PERIOD = 6.4;
const LOOK_FADE_IN = 0.25;
const LOOK_FADE_OUT = 0.35;

// Per-state silhouette deltas for the default body primitives
// (main cloud + two upper lobes): scale about each primitive's own
// centre plus a vertical shift. Keys b<i>x / b<i>y / b<i>d apply to
// primitive i; a 4th+ primitive takes the neutral identity.
const NEUTRAL_BODY = Object.freeze({
  b0x: 1, b0y: 1, b0d: 0,
  b1x: 1, b1y: 1, b1d: 0,
  b2x: 1, b2y: 1, b2d: 0,
});
const BODY_POSES = Object.freeze({
  inhale:   { b0x: 1,    b0y: 1.02, b0d: -0.3, b1x: 1,    b1y: 1.03, b1d: -0.6, b2x: 1,    b2y: 1.04, b2d: -0.7 },
  topup:    { b0x: 1.03, b0y: 0.97, b0d: 0,    b1x: 1,    b1y: 1.1,  b1d: -1.2, b2x: 1,    b2y: 1.16, b2d: -1.6 },
  // hold: weight settles down through the face of the cloud.
  hold:     { b0x: 1,    b0y: 0.99, b0d: 0.3,  b1x: 0.99, b1y: 0.98, b1d: 0.6,  b2x: 0.99, b2y: 0.98, b2d: 0.7 },
  exhale:   { b0x: 1,    b0y: 0.98, b0d: 0.4,  b1x: 1,    b1y: 0.97, b1d: 0.7,  b2x: 1,    b2y: 0.97, b2d: 0.8 },
  proud:    { b0x: 1.01, b0y: 1,    b0d: -0.5, b1x: 1,    b1y: 1,    b1d: -0.5, b2x: 1.04, b2y: 1.04, b2d: -0.6 },
  bright:   { b0x: 1.01, b0y: 1.01, b0d: -0.4, b1x: 1,    b1y: 1.02, b1d: -0.6, b2x: 1.03, b2y: 1.05, b2d: -0.7 },
  // stretch: the body elongates upward while the lobes tuck down.
  stretch:  { b0x: 0.97, b0y: 1.05, b0d: -0.2, b1x: 1,    b1y: 0.94, b1d: 1.2,  b2x: 0.96, b2y: 0.92, b2d: 1.6 },
  sleepy:   { b0x: 1,    b0y: 0.97, b0d: 0.8,  b1x: 1,    b1y: 0.9,  b1d: 1.8,  b2x: 0.97, b2y: 0.88, b2d: 2.0 },
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fin = (v, fallback = 0) => (isFiniteNum(v) ? v : fallback);
const lerp = (a, b, k) => a + (b - a) * k;
const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);
const outQuad = (x) => 1 - (1 - x) * (1 - x);
const inQuad = (x) => x * x;
const inOutQuad = (x) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
// back-out: approaches 1 with one overshoot and lands exactly on 1 —
// the settle shape for releases.
const outBack = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

/** Normalised 0..1 progress of p within the [a, b] window. */
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

function lookBias(t) {
  if (!isFiniteNum(t) || t < 0) return { x: 0, y: 0 };
  const idx = Math.floor(t / LOOK_PERIOD);
  const m = t - idx * LOOK_PERIOD;
  const seed1 = Math.sin(idx * 12.9898 + 4) * 43758.5453;
  const r1 = seed1 - Math.floor(seed1);
  const seed2 = Math.sin(idx * 78.233 + 9) * 12345.6789;
  const r2 = seed2 - Math.floor(seed2);
  const env = Math.min(
    m < LOOK_FADE_IN ? outQuad(m / LOOK_FADE_IN) : 1,
    m > LOOK_PERIOD - LOOK_FADE_OUT
      ? clamp(1 - (m - (LOOK_PERIOD - LOOK_FADE_OUT)) / LOOK_FADE_OUT, 0, 1)
      : 1,
  );
  return { x: (r1 - 0.5) * 4.4 * env, y: (r2 - 0.5) * 3.2 * env };
}

/** Identity reaction frame — everything at rest. */
const REACTION_REST = Object.freeze({
  dy: 0, sx: 1, sy: 1, open: 1, cheek: 0, wisps: 0, mouth: null,
});

/**
 * Three-act reaction curves. All of them end exactly on REACTION_REST,
 * so the reaction ends without a snap the moment p >= 1.
 *
 * The last REACTIONS_LAND_PCT of every curve is the landing park: the
 * pose sits exactly at rest there and the curve is computed on p
 * renormalised into the window before it, so expiry never snaps and
 * the tail never creeps.
 *
 * hop (0.5s):    crouch 0–0.14 → apex stretch 0.14–0.55 → fall, with a
 *                touchdown squash bounce 0.86–0.97.
 * settle (0.9s): gather up 0–0.15 → sink with weight 0.15–0.7 →
 *                spring back with one overshoot 0.7–0.97.
 * celebrate (0.9s): three shrinking hops with touchdown squashes
 *                between, face envelope roaring in and easing out.
 * ready (1.4s):   the pre-performance routine, embodied — gather
 *                softly 0–0.28 (the body drops its shoulders),
 *                release on an exhale 0.28–0.72, ground into
 *                readiness 0.72–1.
 */
const REACTIONS_LAND_PCT = 0.97;

function reactionCurve(name, rawP) {
  const p = rawP >= REACTIONS_LAND_PCT ? 1 : rawP / REACTIONS_LAND_PCT;
  const segP = (a, b) => seg(p, a, b);

  if (name === "hop") {
    const crouch = { dy: 2.2, sx: 1.02, sy: 0.95, open: 0.85 };
    const apex = { dy: -6.5, sx: 0.96, sy: 1.06, open: 1.18 };
    if (p < 0.14) {
      const k = outQuad(segP(0, 0.14));
      return {
        dy: lerp(0, crouch.dy, k), sx: lerp(1, crouch.sx, k),
        sy: lerp(1, crouch.sy, k), open: lerp(1, crouch.open, k),
        cheek: 0, wisps: 0, mouth: null,
      };
    }
    if (p < 0.55) {
      const k = easeOutQuint(segP(0.14, 0.55));
      return {
        dy: lerp(crouch.dy, apex.dy, k), sx: lerp(crouch.sx, apex.sx, k),
        sy: lerp(crouch.sy, apex.sy, k), open: lerp(crouch.open, apex.open, k),
        cheek: 0, wisps: 0, mouth: null,
      };
    }
    if (p < 0.86) {
      const f = inQuad(segP(0.55, 0.86));
      return {
        dy: lerp(apex.dy, 0, f), sx: lerp(apex.sx, 1, f),
        sy: lerp(apex.sy, 1, f), open: lerp(apex.open, 1, f),
        cheek: 0, wisps: 0, mouth: null,
      };
    }
    // Touchdown: compression rises to its peak and returns to 0 —
    // continuous with the fall above and with rest below.
    if (p < 0.97) {
      const squash = Math.sin(Math.PI * segP(0.86, 0.97));
      return { dy: 1.4 * squash, sx: 1 + 0.05 * squash, sy: 1 - 0.07 * squash, open: 1, cheek: 0, wisps: 0, mouth: null };
    }
    return REACTION_REST;
  }

  if (name === "settle") {
    const gather = -0.6;
    if (p < 0.15) {
      const k = outQuad(segP(0, 0.15));
      return { dy: gather * k, sx: 1, sy: 1 + 0.02 * k, open: 1, cheek: 0, wisps: 0, mouth: null };
    }
    if (p < 0.7) {
      const k = inOutQuad(segP(0.15, 0.7));
      return {
        dy: lerp(gather, 2.8, k), sx: lerp(1, 1.03, k),
        sy: lerp(1.02, 0.955, k), open: lerp(1, 0.9, k),
        cheek: 0, wisps: 0, mouth: null,
      };
    }
    if (p < 0.97) {
      const back = outBack(segP(0.7, 0.97));
      return {
        dy: 2.8 * (1 - back), sx: 1 + 0.03 * (1 - back),
        sy: lerp(0.955, 1, back), open: 1, cheek: 0, wisps: 0, mouth: null,
      };
    }
    return REACTION_REST;
  }

  if (name === "celebrate") {
    const bounces = [
      { a: 0.0, b: 0.32, h: -5.2 },
      { a: 0.36, b: 0.62, h: -3.2 },
      { a: 0.66, b: 0.88, h: -2.0 },
    ];
    let dy = 0;
    for (const bo of bounces) {
      if (p >= bo.a && p < bo.b) {
        const k = (p - bo.a) / (bo.b - bo.a);
        dy = k < 0.45
          ? lerp(0, bo.h, easeOutQuint(k / 0.45))
          : lerp(bo.h, 0, inQuad((k - 0.45) / 0.55));
        break;
      }
    }
    let sx = 1;
    let sy = 1;
    for (const [qa, qb] of [[0.3, 0.38], [0.6, 0.68], [0.86, 0.96]]) {
      if (p >= qa && p <= qb) {
        const s = Math.sin(Math.PI * segP(qa, qb));
        sx *= 1 + 0.04 * s;
        sy *= 1 - 0.05 * s;
        dy += 1.2 * s;
        break;
      }
    }
    const env = outQuad(segP(0, 0.15)) * (1 - segP(0.75, 1));
    return {
      dy, sx, sy, open: 1 + 0.2 * env, cheek: 0.55 * env, wisps: 0.65 * env, mouth: "smile",
    };
  }

  if (name === "ready") {
    // Act one — soften: the body gathers downward, like shoulders
    // dropping. Act two — the exhale: a slow release back toward
    // neutral. Act three — ground: a hair of settle into readiness.
    if (p < 0.28) {
      const k = outQuad(segP(0, 0.28));
      // A blink at the touch — it felt that, then it softens.
      const flinch = p < 0.1 ? Math.sin(Math.PI * (p / 0.1)) : 0;
      return {
        dy: 2.4 * k, sx: 1 + 0.02 * k, sy: 1 - 0.04 * k,
        open: 1 - 0.1 * k - 0.65 * flinch, cheek: 0, wisps: 0, mouth: null,
      };
    }
    if (p < 0.72) {
      const k = outQuad(segP(0.28, 0.72));
      return {
        dy: lerp(2.4, 0.4, k), sx: lerp(1.02, 1, k), sy: lerp(0.96, 1.02, k),
        open: lerp(0.9, 1.05, k), cheek: 0.15 * Math.sin(Math.PI * k),
        wisps: 0.3 * Math.sin(Math.PI * k), mouth: null,
      };
    }
    if (p < 0.97) {
      const k = outBack(segP(0.72, 0.97));
      return {
        dy: lerp(0.4, -0.2, k) * (1 - segP(0.9, 0.97)), sx: 1,
        sy: lerp(1.02, 1, k), open: lerp(1.05, 1, k),
        cheek: 0, wisps: 0, mouth: null,
      };
    }
    return REACTION_REST;
  }

  return REACTION_REST;
}

export const MASCOT_REACTIONS = Object.freeze(["hop", "settle", "celebrate", "ready"]);
export const MASCOT_REACTION_DURATIONS = Object.freeze({
  hop: 0.5,
  settle: 0.9,
  celebrate: 0.9,
  ready: 1.4,
});

/**
 * Flight smear — while the sprite travels between screens it deforms
 * along its velocity (smear-blur's core idea): stretched along the
 * direction of travel, squashed across it. Strongest at launch —
 * velocity peaks at the start of the spring flight — and decays
 * quadratically to rest inside MASCOT_SMEAR_DURATION. `age` is
 * supplied by the adapter, like reaction ages, so the engine stays
 * pure.
 */
export const MASCOT_SMEAR_DURATION = 0.55;
const SMEAR_STRETCH = 0.18;
const SMEAR_SQUASH = 0.11;

function smearFrame(sm) {
  const rest = { angle: 0, sx: 1, sy: 1 };
  if (!sm || typeof sm !== "object") return rest;
  const age = fin(sm.age, -1);
  const strength = clamp(fin(sm.strength, 0), 0, 1);
  if (age < 0 || age >= MASCOT_SMEAR_DURATION || strength <= 0) return rest;
  const dx = fin(sm.x, 0);
  const dy = fin(sm.y, 0);
  const len = Math.hypot(dx, dy);
  if (len <= 0.01) return rest;
  const a = strength * (1 - age / MASCOT_SMEAR_DURATION) ** 2;
  return {
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    sx: 1 + SMEAR_STRETCH * a,
    sy: 1 - SMEAR_SQUASH * a,
  };
}

const LOOK_OFFSETS = Object.freeze({
  inhale: Object.freeze({ x: 0, y: -0.6 }),
  exhale: Object.freeze({ x: 0, y: 0.8 }),
  thinking: Object.freeze({ x: 1, y: -1.2 }),
  tender: Object.freeze({ x: 0.4, y: 0.7 }),
});

function pathTokens(d) {
  return typeof d === "string" ? d.match(PATH_TOKEN_RE) || [] : [];
}

export function blendPath(a, b, k) {
  const ta = pathTokens(a);
  const tb = pathTokens(b);
  const sameShape = ta.length === tb.length
    && ta.every((tok, i) => (tok in PATH_ARITY) === (tb[i] in PATH_ARITY)
      && (!(tok in PATH_ARITY) || tok === tb[i]));
  if (!sameShape || ta.length === 0) return k < 0.5 ? a : b;
  return ta
    .map((tok, i) => (tok in PATH_ARITY ? tok : String(lerp(Number(tok), Number(tb[i]), k))))
    .join(" ");
}

export function breathAmount(phase, progress01) {
  const p = (1 - Math.cos(Math.PI * clamp(fin(progress01, 0), 0, 1))) / 2;
  switch (phase) {
    case "inhale": return p;
    case "topup": return 1;
    case "hold": return 1;
    case "exhale": return 1 - p;
    default: return 0;
  }
}

function blinkOpen(t) {
  const m = ((t % BLINK_PERIOD) + BLINK_PERIOD) % BLINK_PERIOD;
  let closed = 0;
  for (const bt of BLINK_TIMES) {
    const dt = Math.abs(m - bt);
    if (dt < BLINK_HALF) {
      closed = Math.max(closed, 0.5 * (1 + Math.cos((Math.PI * dt) / BLINK_HALF)));
    }
  }
  return 1 - (1 - 0.12) * closed;
}

export function sampleMascot(timeSeconds, options = {}) {
  const opts = options || {};
  const avatar = opts.avatar && validateAvatar(opts.avatar).ok ? opts.avatar : BRUME_AVATAR;
  const t = fin(timeSeconds, 0);
  const state = MASCOT_STATES.includes(opts.state) ? opts.state : "idle";
  const presence = opts.presence === "companion" ? "companion" : "quiet";
  const reduced = opts.reducedMotion === true;
  const breathing = opts.breathing === true;
  const period = Math.max(0.5, fin(opts.breathPeriod, 7));
  const expr = EXPRESSIONS[state];
  const idle = state === "idle";
  const companion = presence === "companion";
  // hush (0..1): how still the sprite holds itself. The companion reads
  // agitation in the pointer and answers with stillness — hush suppresses
  // the bob, gaze wander and glance so the body models settling.
  const hush = clamp(fin(opts.hush, 0), 0, 1);

  let breath = null;
  if (!reduced) {
    if (isFiniteNum(opts.breath)) breath = clamp(opts.breath, 0, 1);
    else if (breathing) {
      const cyc = (((t % period) + period) % period) / period;
      breath = (1 - Math.cos(cyc * Math.PI * 2)) / 2;
    }
  }

  let open = expr.open;
  let dy = expr.dy;
  const lid = expr.lid;

  let lookX = 0;
  let lookY = 0;
  if (!reduced && opts.gaze && typeof opts.gaze === "object") {
    lookX = clamp(fin(opts.gaze.x, 0), -GAZE_MAX_X, GAZE_MAX_X);
    lookY = clamp(fin(opts.gaze.y, 0), -GAZE_MAX_Y, GAZE_MAX_Y);
  }
  const lookOff = LOOK_OFFSETS[state];
  if (lookOff) {
    lookX = clamp(lookX + lookOff.x, -GAZE_MAX_X, GAZE_MAX_X);
    lookY = clamp(lookY + lookOff.y, -GAZE_MAX_Y, GAZE_MAX_Y);
  }

  if (!reduced) {
    if (idle && companion) {
      const idleFor = Math.max(0, fin(opts.idleSeconds, 0));
      if (idleFor >= IDLE_SLEEP_AFTER) {
        const k = clamp((idleFor - IDLE_SLEEP_AFTER) / IDLE_SLEEP_FADE, 0, 1);
        open = open + (0.15 - open) * k;
        dy += 1.2 * k;
      }
    }
    if (state !== "hold" && state !== "sleepy") open *= blinkOpen(t);
  }

  const bodyScaleTarget = breath === null ? 1 : 0.86 + breath * 0.18;
  const cheekTarget = state === "hold"
    ? 0.6
    : companion && (state === "proud" || state === "watching" || state === "tender") ? 0.42 : 0;
  const wisped = state === "exhale" || state === "proud";

  const target = {
    open,
    dy,
    lid,
    lookX,
    lookY,
    mouth: avatar.mouths[expr.mouth],
    cheek: cheekTarget,
    arms: state === "stretch" ? 1 : 0,
    wisps: wisped ? 1 : 0,
    waves: state === "hum" ? 0.8 : 0,
    swirl: state === "thinking" ? 0.8 : 0,
    bodyScale: bodyScaleTarget,
    // Silhouette deltas — the state's actual shape in pose space.
    ...(BODY_POSES[state] || NEUTRAL_BODY),
  };

  const stateAge = Math.max(0, fin(opts.stateAge, Infinity));
  const from = !reduced && opts.from && typeof opts.from === "object" ? opts.from : null;
  const k = from ? easeOutQuint(clamp(stateAge / 0.5, 0, 1)) : 1;
  const num = (key) => (from && isFiniteNum(from[key]) ? lerp(from[key], target[key], k) : target[key]);
  const pose = {
    open: num("open"),
    dy: num("dy"),
    lid: num("lid"),
    lookX: num("lookX"),
    lookY: num("lookY"),
    mouth: from && typeof from.mouth === "string"
      ? blendPath(from.mouth, target.mouth, k)
      : target.mouth,
    cheek: num("cheek"),
    arms: num("arms"),
    wisps: num("wisps"),
    waves: num("waves"),
    swirl: num("swirl"),
    bodyScale: num("bodyScale"),
    b0x: num("b0x"), b0y: num("b0y"), b0d: num("b0d"),
    b1x: num("b1x"), b1y: num("b1y"), b1d: num("b1d"),
    b2x: num("b2x"), b2y: num("b2y"), b2d: num("b2d"),
  };

  const rName = opts.reaction && typeof opts.reaction === "object"
      && MASCOT_REACTIONS.includes(opts.reaction.name)
    ? opts.reaction.name
    : null;
  const rp = rName && !reduced
    ? fin(opts.reaction.age, -1) / MASCOT_REACTION_DURATIONS[rName]
    : -1;
  const rActive = rp >= 0 && rp < 1;
  const rc = rActive ? reactionCurve(rName, rp) : REACTION_REST;

  if (rActive) {
    pose.open *= rc.open;
    pose.cheek = Math.max(pose.cheek, rc.cheek);
    pose.wisps = Math.max(pose.wisps, rc.wisps);
    if (rc.mouth) pose.mouth = avatar.mouths[rc.mouth];
  }

  let gazeX = pose.lookX;
  let gazeY = pose.lookY;
  if (!reduced) {
    const still = 1 - hush;
    const ampX = (companion ? (idle ? 1.1 : 0.6) : 0.5) * still;
    const ampY = (companion ? (idle ? 0.6 : 0.35) : 0.3) * still;
    gazeX = clamp(gazeX + ampX * Math.sin((2 * Math.PI * t) / 9), -GAZE_MAX_X, GAZE_MAX_X);
    gazeY = clamp(gazeY + ampY * Math.sin((2 * Math.PI * t) / 13 + 1), -GAZE_MAX_Y, GAZE_MAX_Y);
    if (idle) {
      // The glance: a fresh direction every window, easing in and
      // back out — the life at rest, sized smaller when unattended.
      const b = lookBias(t);
      const kBias = (companion ? 1 : 0.55) * still;
      gazeX = clamp(gazeX + b.x * kBias, -GAZE_MAX_X, GAZE_MAX_X);
      gazeY = clamp(gazeY + b.y * kBias, -GAZE_MAX_Y, GAZE_MAX_Y);
    }
  }

  const eyeBase = avatar.eyes;
  const ry = Math.max(0.4, eyeBase.ry * pose.open);
  const lidHeight = 9 * pose.lid;
  const eyes = {
    left: { cx: eyeBase.leftX + gazeX, cy: eyeBase.y + pose.dy + gazeY, rx: eyeBase.rx, ry },
    right: { cx: eyeBase.rightX + gazeX, cy: eyeBase.y + pose.dy + gazeY, rx: eyeBase.rx, ry },
    lidLeft: {
      x: eyeBase.leftX + gazeX - 4,
      y: eyeBase.y - 4 + pose.dy + gazeY,
      width: 8,
      height: lidHeight,
    },
    lidRight: {
      x: eyeBase.rightX + gazeX - 4,
      y: eyeBase.y - 4 + pose.dy + gazeY,
      width: 8,
      height: lidHeight,
    },
  };

  const root = { y: 0, rotate: 0, sx: 1, sy: 1, originX: 50, originY: 84 };
  if (!reduced) {
    // Idle stillness: the body holds nearly still at rest; the life
    // comes from gaze and blinks. A hair of breathing rhythm remains.
    const bobAmp = (isFiniteNum(opts.breath) ? 0.5 : 1) * (1 - hush);
    if (companion) {
      const cyc = (((t % 7) + 7) % 7) / 7;
      root.y = -0.45 * bobAmp * (1 - Math.cos(cyc * Math.PI * 2)) / 2;
      root.rotate = 0.35 * bobAmp * Math.sin(cyc * Math.PI * 2);
    } else {
      const cyc = (((t % 6) + 6) % 6) / 6;
      root.y = -0.35 * bobAmp * (1 - Math.cos(cyc * Math.PI * 2)) / 2;
    }
    const puff = state === "topup"
      ? 1 + 0.04 * Math.sin(Math.PI * clamp(stateAge / 0.5, 0, 1))
      : 1;
    root.sx = puff;
    root.sy = puff;
    if (rActive) {
      root.y += rc.dy;
      root.sx *= rc.sx;
      root.sy *= rc.sy;
    }
    root.smear = smearFrame(opts.smear);
  } else {
    root.smear = { angle: 0, sx: 1, sy: 1 };
  }
  root.rotate += fin(opts.lean, 0);

  let halo = { opacity: 1, scale: 1 };
  if (!reduced && companion) {
    const cyc = (((t % 7) + 7) % 7) / 7;
    const wave = (1 - Math.cos(cyc * Math.PI * 2)) / 2;
    halo = { opacity: 0.55 + 0.35 * wave, scale: 1 + 0.045 * wave };
  }

  const armSway = (delay) => {
    if (!companion || reduced) return 0;
    const cyc = (((t - delay) % 2.8) + 2.8) % 2.8;
    return -7 * Math.sin((cyc / 2.8) * Math.PI * 2);
  };
  const arms = {
    opacity: pose.arms,
    rotateLeft: armSway(0),
    rotateRight: armSway(0.28),
    pivotLeft: { x: 30, y: 52 },
    pivotRight: { x: 70, y: 52 },
  };

  const wisps = [0, 0.9, 1.8, 2.6].map((delay) => {
    if (reduced) return { dy: 0, opacity: 0.6 * pose.wisps };
    const cyc = (((t - delay) % 3.4) + 3.4) % 3.4;
    const p = cyc / 3.4;
    const ease = 1 - (1 - p) * (1 - p);
    return { dy: -26 * ease, opacity: 0.6 * (1 - p) * pose.wisps };
  });

  const waves = { opacity: pose.waves };
  let swirl = { opacity: pose.swirl, rotate: 0 };
  if (!reduced && state === "thinking") {
    const cyc = (((t % 1.6) + 1.6) % 1.6) / 1.6;
    swirl.rotate = 6 * Math.sin(cyc * Math.PI * 2);
  }

  const bodyPrims = [];
  for (let i = 0; i < avatar.body.length; i += 1) {
    bodyPrims.push(Object.freeze({
      sx: i < 3 ? pose[`b${i}x`] : 1,
      sy: i < 3 ? pose[`b${i}y`] : 1,
      dy: i < 3 ? pose[`b${i}d`] : 0,
    }));
  }

  return Object.freeze({
    state,
    presence,
    reduced,
    breath,
    avatar,
    root,
    pose: Object.freeze(pose),
    body: Object.freeze({
      scale: pose.bodyScale, originX: 50, originY: 55,
      prims: Object.freeze(bodyPrims),
    }),
    eyes,
    mouth: { d: pose.mouth, dx: gazeX * 0.35, dy: gazeY * 0.35 },
    gaze: { x: gazeX, y: gazeY },
    accessories: { halo, arms, cheeks: { opacity: pose.cheek }, wisps, waves, swirl },
  });
}
