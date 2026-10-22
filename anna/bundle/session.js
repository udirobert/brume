// Session storage + host calls for Brume Reset.
// Dependency-free so the node smoke test can import it directly.

import {
  PATTERNS,
  buildPlanPrompt,
  parseModelPlan,
  fallbackPlan,
  buildReflectionPrompt,
  cleanReflection,
  updateSummary,
  personalizationFromSummary,
  PLAN_MAX_TOKENS,
  REFLECTION_MAX_TOKENS,
  FALLBACK_REFLECTION,
  SUMMARY_KEY,
} from "./plan.js";

export { FALLBACK_REFLECTION };
// Back-compat export name used by the smoke test / app.
export const FALLBACK_CLOSING_LINE = FALLBACK_REFLECTION;

// Mid-session pace control (co-breathing). Uniform tempo factors scale
// every phase duration (see timing.js tempo section): slower stretches,
// faster compresses. "normal" is the identity factor. Ordered so the
// Slower/Faster buttons step one level in the named direction.
export const PACE_LEVELS = ["slow", "normal", "fast"];
export const PACE_TEMPO = { slow: 1.25, normal: 1.0, fast: 0.8 };
export const PACE_LABEL = {
  slow: "slower pace",
  normal: "",
  fast: "faster pace",
};

export const PHASE_WORDS = {
  inhale: "Breathe in",
  topup: "Top up",
  hold: "Hold",
  exhale: "Breathe out",
  pause: "Rest",
};

export const PREFS_KEY = "brume/prefs";
export const SOUND_MODES = ["off", "chime", "voice"];

// --- Records -------------------------------------------------------------------

// Factual record: what was planned, what happened, how the user says
// they feel, and which source produced the plan/reflection. No scores,
// no verification language.
export function buildCompletionRecord({
  context,
  pattern,
  plannedSeconds,
  activeSeconds,
  cycles,
  interrupted,
  felt,
  planSource,
  planModel = null,
  reflectionModel = null,
  reflection,
  source,
  now,
}) {
  return {
    completedAt: new Date(now).toISOString(),
    context: typeof context === "string" ? context.slice(0, 200) : "",
    pattern,
    plannedSeconds,
    activeSeconds,
    cycles,
    interrupted: Boolean(interrupted),
    felt: felt === "calmer" || felt === "same" || felt === "wired" ? felt : null,
    planSource,
    planModel,
    reflectionModel,
    reflection: typeof reflection === "string" ? reflection : "",
    source: source === "executa.chat" ? "executa.chat" : "app",
  };
}

function unwrap(res) {
  // SDK calls resolve {ok:true,result} or {ok:false,error}; some harness
  // paths reject instead. Normalize both to throw-on-failure.
  if (res && typeof res === "object") {
    if (res.ok === false) {
      const err = res.error || {};
      const e = new Error(err.message || "storage write failed");
      e.code = err.code;
      throw e;
    }
    if (res.ok === true && "result" in res) return res.result;
  }
  return res;
}

export function unwrapHostResponse(res) {
  return unwrap(res);
}

export function storageValue(res) {
  const r = unwrap(res);
  if (r == null) return null;
  if (typeof r === "object" && "value" in r) return r.value;
  return r;
}

function storageArgs(extra) {
  return { scope: "user", ...extra };
}

// Writes the completion record + summary to per-user APS KV via the host
// API. `anna` is the AnnaAppRuntime object (or a compatible test double).
// Throws on failure — the caller shows a "couldn't save" note.
export async function saveCompletionRecord(anna, record) {
  const key = `reset/sessions/${record.completedAt}`;
  await unwrap(
    await anna.storage.set(storageArgs({ key, value: record })),
  );
  await unwrap(
    await anna.storage.set(storageArgs({ key: "reset/last", value: record })),
  );
  // Read-modify-write the rolling summary. A lost race just loses one
  // session's contribution — acceptable for a counter.
  const res = await unwrap(
    await anna.storage.get(storageArgs({ key: SUMMARY_KEY })),
  );
  const summary = storageValue(res) ?? /* no summary yet */ null;
  const already = Array.isArray(summary?.recent)
    && summary.recent.some((r) => r && r.completedAt === record.completedAt);
  if (!already) {
    await unwrap(
      await anna.storage.set(
        storageArgs({ key: SUMMARY_KEY, value: updateSummary(summary, record) }),
      ),
    );
  }
  return key;
}

export async function loadLastRecord(anna) {
  const res = await unwrap(
    await anna.storage.get(storageArgs({ key: "reset/last" })),
  );
  return res && typeof res === "object" && "value" in res ? res.value : res;
}

export async function loadSummary(anna) {
  try {
    const res = await unwrap(
      await anna.storage.get(storageArgs({ key: SUMMARY_KEY })),
    );
    const v = res && typeof res === "object" && "value" in res ? res.value : res;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

export async function loadPrefs(anna) {
  try {
    const res = await unwrap(
      await anna.storage.get(storageArgs({ key: PREFS_KEY })),
    );
    const v = res && typeof res === "object" && "value" in res ? res.value : res;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export async function savePrefs(anna, prefs) {
  await unwrap(
    await anna.storage.set(storageArgs({ key: PREFS_KEY, value: prefs })),
  );
}

export function summaryLine(summary) {
  const p = personalizationFromSummary(summary);
  if (!p) return null;
  // "cyclic-sigh: calmer 3 of 4" -> "Cyclic sigh — calmer 3 of 4 times"
  const [id, rest] = p.split(/: (.+)/);
  const name = PATTERNS[id] ? PATTERNS[id].name : id;
  return `${name} — ${rest} times`;
}

// --- LLM plumbing ---------------------------------------------------------------
//
// Both the plan call and the reflection call go through anna.llm.complete.
// The successful calls are what make each run server-observable. Every
// failure, timeout, denial, or absent SDK resolves to a deterministic
// fallback so the UI never blocks on the model.

const PLAN_TIMEOUT_MS = 8000;
const REFLECTION_TIMEOUT_MS = 6000;

// Accepts the llm.complete result ({role, content:{type:"text",text}}) or a
// raw {ok:false,error} envelope — normalize to a trimmed string.
export function responseText(res) {
  const r = unwrap(res);
  const content = r && r.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join(" ");
  } else if (content && typeof content === "object") {
    text = String(content.text ?? "");
  }
  return text.trim();
}

export function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => {
      const e = new Error(`llm.complete timed out after ${ms}ms`);
      e.code = "timeout";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

let lastLlmModel = null;
export let lastReflectionModel = null;

async function callLlm(anna, prompt, maxTokens, timeoutMs) {
  const res = await withTimeout(
    Promise.resolve(
      anna.llm.complete({
        messages: [
          { role: "user", content: { type: "text", text: prompt } },
        ],
        maxTokens,
      }),
    ),
    timeoutMs,
  );
  const text = responseText(res);
  lastLlmModel = res?.model ?? null;
// Diagnostic hook for dev/testing: last prompt + raw model text.
  try {
    const h = window.location?.hostname;
    if (h === "localhost" || h === "127.0.0.1")
      window.__brumeLastLlm = { prompt, text };
  } catch {
    /* non-window contexts (tests) */
  }
  return text;
}

// Plan via the model. Never throws — resolves {plan, plannedOffline}
// where plan is a validated plan object; on any failure the plan is the
// deterministic fallback for the same context.
export async function fetchPlan(anna, { context, summary }, opts) {
  lastLlmModel = null;
  const fb = () => fallbackPlan(context);
  if (!anna || typeof anna.llm?.complete !== "function") {
    return { plan: fb(), offline: true };
  }
  const timeoutMs = opts?.timeoutMs ?? PLAN_TIMEOUT_MS;
  try {
    const raw = await callLlm(
      anna,
      buildPlanPrompt(context, personalizationFromSummary(summary)),
      PLAN_MAX_TOKENS,
      timeoutMs,
    );
    const plan = parseModelPlan(raw);
    if (plan) plan.planModel = lastLlmModel;
    return plan ? { plan, offline: false } : { plan: fb(), offline: true };
  } catch {
    return { plan: fb(), offline: true };
  }
}

// Reflection via the model. Never throws — resolves the cleaned line or
// the fixed fallback.
export async function fetchReflection(anna, facts, opts) {
  lastLlmModel = null;
  if (!anna || typeof anna.llm?.complete !== "function") {
    return FALLBACK_REFLECTION;
  }
  const timeoutMs = opts?.timeoutMs ?? REFLECTION_TIMEOUT_MS;
  try {
    const raw = await callLlm(
      anna,
      buildReflectionPrompt(facts),
      REFLECTION_MAX_TOKENS,
      timeoutMs,
    );
    const t = cleanReflection(raw);
    if (t === FALLBACK_REFLECTION) return t;
    lastReflectionModel = lastLlmModel;
    return t;
  } catch {
    return FALLBACK_REFLECTION;
  }
}

// Kept for back-compat with any callers of the old name.
export const fetchClosingLine = fetchReflection;
