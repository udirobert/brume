// AI plan + reflection contract for Brume Reset.
// Dependency-free: imported by the bundle, the node smoke test, and
// mirrored 1:1 by the Python plugin (executas/brume). Any change here
// must be ported to brume_plugin.py and covered by test/plan-cases.json.

// --- Pattern library --------------------------------------------------------
// Phases are seconds. `topup` sits between inhale and hold (cyclic sigh's
// second sip of air); hold is between topup and exhale; holdAfterExhale
// closes the cycle. Patterns with no topup/hold behave exactly as before.

export const PATTERNS = {
  "cyclic-sigh": {
    id: "cyclic-sigh",
    name: "Cyclic sigh",
    rhythm: "2s in · 1s top-up · 6s out",
    inhale: 2,
    topup: 1,
    hold: 0,
    exhale: 6,
    holdAfterExhale: 0,
  },
  "long-exhale": {
    id: "long-exhale",
    name: "Long exhale",
    rhythm: "4s in · 6s out",
    inhale: 4,
    topup: 0,
    hold: 0,
    exhale: 6,
    holdAfterExhale: 0,
  },
  box: {
    id: "box",
    name: "Box",
    rhythm: "4s in · 4s hold · 4s out · 4s hold",
    inhale: 4,
    topup: 0,
    hold: 4,
    exhale: 4,
    holdAfterExhale: 4,
  },
  steady: {
    id: "steady",
    name: "Steady",
    rhythm: "5.5s in · 5.5s out",
    inhale: 5.5,
    topup: 0,
    hold: 0,
    exhale: 5.5,
    holdAfterExhale: 0,
  },
};

export const PATTERN_IDS = Object.keys(PATTERNS);
export const ALLOWED_LENGTHS = [60, 90, 120, 180];
export const QUICK_PLAN = { pattern: "long-exhale", seconds: 90 };

// Canned per-pattern text — used for the deterministic fallback plan and
// to fill missing/invalid fields of a model plan. No health claims.
const CANNED = {
  "cyclic-sigh": {
    title: "A steadying pause",
    opening:
      "Two short sips of air, then one long out-breath — a way to settle before what's next.",
    cues: ["Shoulders soft", "Slow the out-breath", "Unclench your jaw"],
    why: "The double inhale and long exhale suits the minutes before something tense.",
  },
  "long-exhale": {
    title: "A quiet reset",
    opening:
      "A gentle rhythm — four counts in, six counts out — between one thing and the next.",
    cues: ["Easy in-breath", "Long slow out-breath"],
    why: "A simple longer exhale makes a gentle break between tasks.",
  },
  box: {
    title: "A square breath",
    opening:
      "Four even sides — in, hold, out, hold — to gather your attention.",
    cues: ["Follow the four sides", "Even counts, no rush"],
    why: "Its even structure suits getting ready for focused work.",
  },
  steady: {
    title: "An easy rhythm",
    opening: "An unhurried five and a half counts in, the same back out.",
    cues: ["No hurry", "Let the pace carry you"],
    why: "An even, slow rhythm suits winding down.",
  },
};

// --- Text hygiene ------------------------------------------------------------

// Emoji-ish and control characters the model may add despite instructions.
// Keep the set deliberately conservative so it stays identical in Python.
const STRIP_RE =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2060\uFEFF\uFE0F\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;

export function cleanText(s, maxLen) {
  if (typeof s !== "string") return "";
  const cleaned = s
    .replace(STRIP_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned;
}

// The user's one-line context, safe to embed in a prompt: trimmed,
// quotes/newlines stripped, capped at 200 chars.
export function cleanContext(input) {
  if (typeof input !== "string") return "";
  return cleanText(input.replace(/["'\r\n]+/g, " "), 200);
}

// --- Plan prompt --------------------------------------------------------------

const PLAN_LIBRARY_BLOCK = `You plan one short guided breathing break for a person at work. Choose from this fixed library only:
- cyclic-sigh: two inhales through the nose (2s, then a 1s top-up), then a long 6s exhale. Suits the moments right before something tense, or when they feel keyed up.
- long-exhale: 4s in, 6s out. A gentle general reset between tasks.
- box: 4s in, 4s hold, 4s out, 4s hold. Steady and structured; suits getting ready for focused work.
- steady: 5.5s in, 5.5s out. Even and unhurried; suits winding down.
Allowed lengths in seconds: 60, 90, 120, 180. Use 60 if they mention having little time.`;

const PLAN_FORMAT_BLOCK = `Reply with ONLY a JSON object, no prose and no code fences:
{"pattern": one of the four ids, "seconds": one of the allowed lengths, "title": up to 6 words naming this break, "opening": one or two calm sentences (max 30 words) that respond to what they said, "cues": 2 or 3 short phrases (max 8 words each) to show during the break, "why": one sentence (max 20 words) on why this pattern fits their moment}
Do not make medical or health claims, do not diagnose, and do not use emoji.`;

// personalization: string like "cyclic-sigh: calmer 3 of 4; box: calmer 1
// of 3" built from summary byPattern entries with >=2 ratings, or null.
export function buildPlanPrompt(context, personalization) {
  const ctx = cleanContext(context) || "nothing specific";
  const parts = [
    PLAN_LIBRARY_BLOCK,
    `What the person said they are doing or about to do: "${ctx}"`,
  ];
  if (personalization) {
    parts.push(
      `What has worked for them before (their own after-session ratings): ${personalization}. Prefer a pattern they rated calmer, unless their note clearly fits another one better.`,
    );
  }
  parts.push(PLAN_FORMAT_BLOCK);
  return parts.join("\n\n");
}

export const PLAN_MAX_TOKENS = 300;

// --- Plan parsing + validation -----------------------------------------------

// Extract the first balanced {...} region, tolerating code fences and
// prose around it. Returns "" when no balanced object is found.
function firstJsonObject(text) {
  const s = String(text ?? "");
  const start = s.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return "";
}

function snapSeconds(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return QUICK_PLAN.seconds;
  let best = ALLOWED_LENGTHS[0];
  for (const len of ALLOWED_LENGTHS) {
    if (Math.abs(n - len) < Math.abs(n - best)) best = len;
  }
  return best;
}

// Raw model text -> validated plan, or null when the whole plan must fall
// back (unparseable, or an unknown pattern id). Returned shape:
// {pattern, seconds, title, opening, cues, why} with planSource "ai".
export function parseModelPlan(raw) {
  const obj = firstJsonObject(raw);
  if (!obj) return null;
  let parsed;
  try {
    parsed = JSON.parse(obj);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const pattern = PATTERNS[parsed.pattern] ? parsed.pattern : null;
  if (!pattern) return null;
  const canned = CANNED[pattern];
  const title = cleanText(parsed.title, 60) || canned.title;
  const opening = cleanText(parsed.opening, 240) || canned.opening;
  const why = cleanText(parsed.why, 160) || canned.why;
  const cues = Array.isArray(parsed.cues)
    ? parsed.cues.map((c) => cleanText(c, 60)).filter(Boolean).slice(0, 3)
    : [];
  for (const c of canned.cues) {
    if (cues.length >= 2) break;
    if (!cues.includes(c)) cues.push(c);
  }
  return {
    pattern,
    seconds: snapSeconds(parsed.seconds),
    title,
    opening,
    cues,
    why,
    planSource: "ai",
  };
}

// --- Deterministic fallback ---------------------------------------------------

const FALLBACK_RULES = [
  [
    /call|meeting|present|interview|pitch|send|email|exam|nervous|anxious|tense|stress/,
    { pattern: "cyclic-sigh", seconds: 90 },
  ],
  [
    /focus|deep work|code|coding|write|writing|study|concentrat/,
    { pattern: "box", seconds: 120 },
  ],
  [
    /sleep|bed|wind down|winding down|evening|tired|done for the day/,
    { pattern: "steady", seconds: 180 },
  ],
];

export function fallbackPlan(context, planSource = "fallback") {
  const ctx = cleanContext(context).toLowerCase();
  let pick = { pattern: "long-exhale", seconds: 90 };
  for (const [re, p] of FALLBACK_RULES) {
    if (re.test(ctx)) {
      pick = p;
      break;
    }
  }
  const canned = CANNED[pick.pattern];
  return {
    pattern: pick.pattern,
    seconds: pick.seconds,
    title: canned.title,
    opening: canned.opening,
    cues: canned.cues.slice(0, 3),
    why: canned.why,
    planSource,
  };
}

// --- Reflection prompt + cleaning ----------------------------------------------

export const REFLECTION_MAX_TOKENS = 120;
export const FALLBACK_REFLECTION =
  "Take a moment before you begin again.";

export function buildReflectionPrompt({
  context,
  patternName,
  activeSeconds,
  plannedSeconds,
  cycles,
  interrupted,
  felt,
}) {
  const ctx = cleanContext(context) || "nothing specific";
  const feltWord =
    felt === "calmer" ? "calmer"
    : felt === "same" ? "about the same"
    : felt === "wired" ? "still wired"
    : "not given";
  return `You write the short note shown after a guided breathing break.
Facts:
- What they said they were doing or about to do: "${ctx}"
- Pattern: ${patternName}
- Active time: ${activeSeconds} seconds of a planned ${plannedSeconds}; cycles completed: ${cycles}; ended early: ${interrupted ? "yes" : "no"}
- How they say they feel now: ${feltWord}
Write at most 2 sentences and 35 words in total. First, acknowledge how it went in plain words (if they are still wired or ended early, be matter-of-fact and never guilt them). Second, give one concrete next step tied to what they said they are doing next. Plain text only, no emoji, no medical or health claims, and do not mention breathing science.`;
}

// Model text -> displayable note. Empty or JSON-ish output falls back.
export function cleanReflection(raw) {
  let text = String(raw ?? "").replace(/\s+/g, " ").trim();
  // strip one layer of wrapping quotes
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  if (!text || text.startsWith("{")) return FALLBACK_REFLECTION;
  return text.length > 300 ? text.slice(0, 300).trim() : text;
}

// --- Session summary (reset/summary) -------------------------------------------
//
// {version:1, total, byPattern:{<id>:{sessions, calmer, same, wired}},
//  recent:[last 10 compact records]}
// Ratings = sessions where felt was reported.

export const SUMMARY_KEY = "reset/summary";
const RECENT_MAX = 10;

export function emptySummary() {
  return { version: 1, total: 0, byPattern: {}, recent: [] };
}

// Pure read-modify-write: fold one completion record into a summary
// object (missing/partial tolerated). Returns a new object.
export function updateSummary(summary, record) {
  const s =
    summary && typeof summary === "object" && summary.byPattern
      ? summary
      : emptySummary();
  const byPattern = { ...s.byPattern };
  const pid = PATTERNS[record.pattern] ? record.pattern : null;
  if (pid) {
    const prev = byPattern[pid] || { sessions: 0, calmer: 0, same: 0, wired: 0 };
    const next = { ...prev, sessions: prev.sessions + 1 };
    if (record.felt === "calmer") next.calmer += 1;
    else if (record.felt === "same") next.same += 1;
    else if (record.felt === "wired") next.wired += 1;
    byPattern[pid] = next;
  }
  const recent = [
    {
      completedAt: record.completedAt,
      pattern: record.pattern,
      activeSeconds: record.activeSeconds,
      felt: record.felt ?? null,
      interrupted: Boolean(record.interrupted),
    },
    ...(Array.isArray(s.recent) ? s.recent : []),
  ].slice(0, RECENT_MAX);
  return {
    version: 1,
    total: (Number(s.total) || 0) + 1,
    byPattern,
    recent,
  };
}

// Personalization string for the plan prompt: "<id>: <dominant felt> x of
// n" for each pattern with >=2 reported ratings. Ties resolve calmer >
// same > wired (what "worked" is the interesting signal). null when none.
export function personalizationFromSummary(summary) {
  const bp = summary && summary.byPattern;
  if (!bp || typeof bp !== "object") return null;
  const parts = [];
  for (const id of PATTERN_IDS) {
    const p = bp[id];
    if (!p) continue;
    const ratings = (p.calmer || 0) + (p.same || 0) + (p.wired || 0);
    if (ratings < 2) continue;
    const label =
      p.calmer >= p.same && p.calmer >= p.wired ? "calmer"
      : p.same >= p.wired ? "about the same"
      : "still wired";
    const count =
      label === "calmer" ? p.calmer
      : label === "about the same" ? p.same
      : p.wired;
    parts.push(`${id}: ${label} ${count} of ${ratings}`);
  }
  return parts.length ? parts.join("; ") : null;
}
