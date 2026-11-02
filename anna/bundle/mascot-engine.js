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
    closed: "M 44 60 Q 50 63 56 60",
    smile: "M 43 58 Q 50 65 57 58",
    open: "M 47 59 Q 50 63 53 59 Q 50 65 47 59 Z",
    flat: "M 45 61 L 55 61",
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
});

const BLINK_PERIOD = 20;
const BLINK_TIMES = [4.8, 10.4, 17.2];
const BLINK_HALF = 0.14;

const GAZE_MAX_X = 2.4;
const GAZE_MAX_Y = 1.8;
const IDLE_SLEEP_AFTER = 120;
const IDLE_SLEEP_FADE = 60;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fin = (v, fallback = 0) => (isFiniteNum(v) ? v : fallback);

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
  let gazeX = 0;
  let gazeY = 0;

  if (!reduced) {
    if (opts.gaze && typeof opts.gaze === "object") {
      gazeX = clamp(fin(opts.gaze.x, 0), -GAZE_MAX_X, GAZE_MAX_X);
      gazeY = clamp(fin(opts.gaze.y, 0), -GAZE_MAX_Y, GAZE_MAX_Y);
    }
    if (idle && companion) {
      gazeX += 1.1 * Math.sin((2 * Math.PI * t) / 9);
      gazeY += 0.6 * Math.sin((2 * Math.PI * t) / 13 + 1);
      gazeX = clamp(gazeX, -GAZE_MAX_X, GAZE_MAX_X);
      gazeY = clamp(gazeY, -GAZE_MAX_Y, GAZE_MAX_Y);
      const idleFor = Math.max(0, fin(opts.idleSeconds, 0));
      if (idleFor >= IDLE_SLEEP_AFTER) {
        const k = clamp((idleFor - IDLE_SLEEP_AFTER) / IDLE_SLEEP_FADE, 0, 1);
        open = open + (0.15 - open) * k;
        dy += 1.2 * k;
      }
    }
    if (idle) open *= blinkOpen(t);
  }

  const eyeBase = avatar.eyes;
  const ry = Math.max(0.4, eyeBase.ry * open);
  const lidHeight = 9 * lid;
  const eyes = {
    left: { cx: eyeBase.leftX + gazeX, cy: eyeBase.y + dy + gazeY, rx: eyeBase.rx, ry },
    right: { cx: eyeBase.rightX + gazeX, cy: eyeBase.y + dy + gazeY, rx: eyeBase.rx, ry },
    lidLeft: {
      x: eyeBase.leftX + gazeX - 4,
      y: eyeBase.y - 4 + dy + gazeY,
      width: 8,
      height: lidHeight,
    },
    lidRight: {
      x: eyeBase.rightX + gazeX - 4,
      y: eyeBase.y - 4 + dy + gazeY,
      width: 8,
      height: lidHeight,
    },
  };

  const bodyScale = breath === null ? 1 : 0.86 + breath * 0.18;

  const stateAge = Math.max(0, fin(opts.stateAge, Infinity));
  const puff = state === "topup" && !reduced
    ? 1 + 0.04 * Math.sin(Math.PI * clamp(stateAge / 0.5, 0, 1))
    : 1;

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
    opacity: state === "stretch" ? 1 : 0,
    rotateLeft: armSway(0),
    rotateRight: armSway(0.28),
    pivotLeft: { x: 30, y: 52 },
    pivotRight: { x: 70, y: 52 },
  };

  const cheekOpacity = state === "hold"
    ? 0.6
    : companion && (state === "proud" || state === "watching") ? 0.42 : 0;

  const wisped = state === "exhale" || state === "proud";
  const wisps = [0, 0.9, 1.8, 2.6].map((delay) => {
    if (!wisped) return { dy: 0, opacity: 0 };
    if (reduced) return { dy: 0, opacity: 0.6 };
    const cyc = (((t - delay) % 3.4) + 3.4) % 3.4;
    const p = cyc / 3.4;
    const ease = 1 - (1 - p) * (1 - p);
    return { dy: -26 * ease, opacity: 0.6 * (1 - p) };
  });

  const waves = { opacity: state === "hum" ? 0.8 : 0 };
  let swirl = { opacity: state === "thinking" ? 0.8 : 0, rotate: 0 };
  if (!reduced && state === "thinking") {
    const cyc = (((t % 1.6) + 1.6) % 1.6) / 1.6;
    swirl.rotate = 6 * Math.sin(cyc * Math.PI * 2);
  }

  return Object.freeze({
    state,
    presence,
    reduced,
    breath,
    avatar,
    svg: { scale: puff, originX: 50, originY: 58 },
    body: { scale: bodyScale, originX: 50, originY: 55 },
    eyes,
    mouth: { d: avatar.mouths[expr.mouth], dx: gazeX * 0.35, dy: gazeY * 0.35 },
    gaze: { x: gazeX, y: gazeY },
    accessories: { halo, arms, cheeks: { opacity: cheekOpacity }, wisps, waves, swirl },
  });
}
