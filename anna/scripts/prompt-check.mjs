// Tier-2 prompt check: run Brume's real prompt builders + validators against
// the same model family Anna serves, without spending Anna account quota.
//
// Anna's llm.complete runs on the USER's chosen model (default seen in Anna:
// Gemini 3 Flash Preview); apps cannot pin it — modelPreferences only breaks
// ties among models the user enabled. So we test against Gemini 3 Flash via
// Google's OpenAI-compatible endpoint, at Anna's default temperature (0.7,
// since Brume sends none). Featherless is a fallback proxy only, and its Chat
// plan forbids automated/benchmark traffic.
//
// Usage (from anna/):  node scripts/prompt-check.mjs [plan|reflection|alertness|all]
// Needs anna/.env.local with GEMINI_API_KEY (preferred) or FEATHERLESS_API_KEY.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildPlanPrompt, parseModelPlan, PLAN_MAX_TOKENS, CUE_FORBIDDEN_RE, HEALTH_CLAIM_RE,
  buildReflectionPrompt, cleanReflection, REFLECTION_MAX_TOKENS, FALLBACK_REFLECTION,
} from "../bundle/plan.js";
import { alertnessNotePrompt, ALERTNESS_FALLBACK_NOTE } from "../bundle/alertness.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n").filter((l) => /^\w+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const provider = env.GEMINI_API_KEY
  ? { name: "gemini", base: env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
      key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || "gemini-3-flash-preview" }
  : env.FEATHERLESS_API_KEY
    ? { name: "featherless (proxy only)", base: env.FEATHERLESS_BASE_URL || "https://api.featherless.ai/v1",
        key: env.FEATHERLESS_API_KEY, model: env.FEATHERLESS_MODEL || "deepseek-ai/DeepSeek-V3-0324" }
    : null;
if (!provider) throw new Error("Set GEMINI_API_KEY (preferred) or FEATHERLESS_API_KEY in anna/.env.local");
const MODEL = provider.model;
const TEMPERATURE = Number(env.LLM_TEMPERATURE ?? 0.7); // Anna's llm.complete default

async function complete(prompt, maxTokens) {
  const t0 = Date.now();
  const res = await fetch(`${provider.base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: TEMPERATURE,
      messages: [{ role: "user", content: prompt }] }),
  });
  const raw = await res.text();
  let body;
  try { body = JSON.parse(raw); } catch { throw new Error(`${res.status} non-JSON response: ${raw.slice(0, 120)}`); }
  if (body?.[0]?.error) body = body[0];
  if (!res.ok || body.error) throw new Error(`${res.status} ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
  const choice = body.choices?.[0] ?? {};
  if (choice.finish_reason === "length" || !(choice.message?.content ?? "").trim()) {
    console.log(`  ⚠ finish_reason=${choice.finish_reason} with maxTokens=${maxTokens}; usage=${JSON.stringify(body.usage)}`);
  }
  return { text: choice.message?.content ?? "", finish: choice.finish_reason, usage: body.usage, ms: Date.now() - t0 };
}

const PLAN_CONTEXTS = [
  "Big call with my manager in 10 minutes",
  "Been debugging for 3 hours, brain is fried",
  "Need to focus on writing a report next",
  "Winding down before bed",
  "",
  "I only have a minute",
];

async function checkPlans() {
  let fallbacks = 0, cueHits = 0, healthHits = 0;
  for (const ctx of PLAN_CONTEXTS) {
    const { text, ms } = await complete(buildPlanPrompt(ctx, null), PLAN_MAX_TOKENS);
    const plan = parseModelPlan(text);
    let raw = null;
    try { raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch {}
    const rawCues = Array.isArray(raw?.cues) ? raw.cues : [];
    const cueViolations = rawCues.filter((c) => CUE_FORBIDDEN_RE.test(c));
    const healthFields = raw ? ["title", "opening", "why"].filter((k) => HEALTH_CLAIM_RE.test(String(raw[k] ?? ""))) : [];
    if (!plan) fallbacks++;
    cueHits += cueViolations.length;
    healthHits += healthFields.length;
    console.log(`\n[plan] "${ctx || "(empty)"}" ${ms}ms -> ${plan ? `${plan.pattern} ${plan.seconds}s "${plan.title}"` : "FALLBACK (unparseable/invalid)"}`);
    if (plan) console.log(`  opening: ${plan.opening}\n  why: ${plan.why}\n  cues: ${plan.cues.join(" | ")}`);
    if (cueViolations.length) console.log(`  raw cues replaced by filter: ${cueViolations.join(" | ")}`);
    if (healthFields.length) console.log(`  raw health-claim text replaced in: ${healthFields.join(", ")}`);
  }
  return { cases: PLAN_CONTEXTS.length, fallbacks, cueHits, healthHits };
}

const REFLECTION_CASES = [
  { context: "Big call with my manager in 10 minutes", patternName: "Cyclic sigh", activeSeconds: 90, plannedSeconds: 90, cycles: 10, interrupted: false, felt: "calmer" },
  { context: "Need to focus on writing a report next", patternName: "Box", activeSeconds: 64, plannedSeconds: 64, cycles: 4, interrupted: false, felt: "same" },
  { context: "Been debugging for 3 hours", patternName: "Long exhale", activeSeconds: 31, plannedSeconds: 90, cycles: 3, interrupted: true, felt: "wired" },
];

async function checkReflections() {
  let fallbacks = 0;
  for (const facts of REFLECTION_CASES) {
    const { text, ms } = await complete(buildReflectionPrompt(facts), REFLECTION_MAX_TOKENS);
    const shown = cleanReflection(text);
    if (shown === FALLBACK_REFLECTION) fallbacks++;
    console.log(`\n[reflection] felt=${facts.felt} interrupted=${facts.interrupted} ${ms}ms\n  raw: ${text.trim()}\n  shown: ${shown}`);
  }
  return { cases: REFLECTION_CASES.length, fallbacks };
}

const ALERT_CASES = [
  { metrics: { medianMs: 305, lapses: 0, trials: 14, falseStarts: 1 }, baseline: null, band: null, kss: 4, checkCount: 1, timeOfDay: "14:05" },
  { metrics: { medianMs: 388, lapses: 2, trials: 13, falseStarts: 0 }, baseline: 310, band: "slower than usual", kss: 7, checkCount: 5, timeOfDay: "15:30" },
  { metrics: { medianMs: 276, lapses: 0, trials: 15, falseStarts: 0 }, baseline: 310, band: "sharper than usual", kss: 2, checkCount: 6, timeOfDay: "09:10" },
];

async function checkAlertness() {
  let fallbacks = 0;
  for (const c of ALERT_CASES) {
    const { text, ms } = await complete(alertnessNotePrompt(c), REFLECTION_MAX_TOKENS);
    const cleaned = cleanReflection(text);
    const shown = cleaned === FALLBACK_REFLECTION ? ALERTNESS_FALLBACK_NOTE : cleaned;
    if (shown === ALERTNESS_FALLBACK_NOTE) fallbacks++;
    console.log(`\n[alertness] band=${c.band ?? "no baseline"} kss=${c.kss} ${ms}ms\n  raw: ${text.trim()}\n  shown: ${shown}`);
  }
  return { cases: ALERT_CASES.length, fallbacks };
}

const which = process.argv[2] || "all";
console.log(`provider: ${provider.name} · model: ${MODEL} · temperature: ${TEMPERATURE}`);
const summary = {};
if (which === "plan" || which === "all") summary.plan = await checkPlans();
if (which === "reflection" || which === "all") summary.reflection = await checkReflections();
if (which === "alertness" || which === "all") summary.alertness = await checkAlertness();
console.log("\nsummary:", JSON.stringify(summary));
