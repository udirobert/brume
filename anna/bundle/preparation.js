import { cleanText, HEALTH_CLAIM_RE } from "./plan.js";
import { responseText } from "./session.js";
import {
  buildPreparationMessages,
  buildRehearsalMessages,
  PREPARATION_MAX_TOKENS,
  REHEARSAL_MAX_TOKENS,
} from "./preparation-prompts.js";

export const PREPARATION_CAPS = {
  question: 180,
  opening: 300,
  keyPoint: 220,
  approach: 300,
  objection: 240,
  response: 360,
  nextStep: 220,
  adjustment: 300,
};

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

function strictJsonObject(raw) {
  let s = String(raw ?? "").trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(s);
  if (fence) s = fence[1].trim();
  const obj = firstJsonObject(s);
  if (!obj || obj !== s) return null;
  try {
    const parsed = JSON.parse(obj);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function field(v, cap) {
  if (typeof v !== "string") return null;
  if (v.trim().length > cap) return null;
  const t = cleanText(v, cap);
  if (!t || HEALTH_CLAIM_RE.test(t)) return null;
  return t;
}

export function parsePreparation(raw, { clarificationUsed = false } = {}) {
  const parsed = strictJsonObject(raw);
  if (!parsed) return null;
  if (parsed.kind === "clarify") {
    if (clarificationUsed) return null;
    const question = field(parsed.question, PREPARATION_CAPS.question);
    if (!question) return null;
    return { kind: "clarify", question };
  }
  if (parsed.kind !== "plan") return null;
  const plan = {};
  for (const key of [
    "opening",
    "keyPoint",
    "approach",
    "objection",
    "response",
    "nextStep",
  ]) {
    const v = field(parsed[key], PREPARATION_CAPS[key]);
    if (v === null) return null;
    plan[key] = v;
  }
  return { kind: "plan", ...plan };
}

export function parseRehearsal(raw) {
  const parsed = strictJsonObject(raw);
  if (!parsed) return null;
  const out = {};
  for (const key of ["adjustment", "response", "nextStep"]) {
    const v = field(parsed[key], PREPARATION_CAPS[key]);
    if (v === null) return null;
    out[key] = v;
  }
  return out;
}

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => {
      const e = new Error(`Preparation is taking too long — try again.`);
      e.code = "timeout";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function unavailableError() {
  const e = new Error(
    "Preparation needs Anna's AI, which isn't connected right now.",
  );
  e.code = "unavailable";
  return e;
}

function invalidError() {
  const e = new Error(
    "The AI reply wasn't usable — nothing was prepared. Try again.",
  );
  e.code = "invalid";
  return e;
}

async function request(anna, messages, maxTokens, parse, timeoutMs) {
  if (!anna || typeof anna.llm?.complete !== "function") {
    throw unavailableError();
  }
  let res;
  try {
    res = await withTimeout(
      Promise.resolve(anna.llm.complete({ messages, maxTokens })),
      timeoutMs,
    );
  } catch (e) {
    if (e && e.code === "timeout") throw e;
    if (e && e.code) throw e;
    const err = new Error(e?.message || "The AI request failed.");
    err.code = "failed";
    throw err;
  }
  let parsed;
  try {
    parsed = parse(responseText(res));
  } catch (e) {
    if (e && e.code) throw e;
    throw invalidError();
  }
  if (!parsed) throw invalidError();
  return { value: parsed, model: res?.model ?? res?.result?.model ?? null };
}

export async function requestPreparation(anna, input, { timeoutMs = 25000 } = {}) {
  return request(
    anna,
    buildPreparationMessages(input),
    PREPARATION_MAX_TOKENS,
    (raw) => parsePreparation(raw, { clarificationUsed: input?.clarificationUsed }),
    timeoutMs,
  );
}

export async function requestRehearsal(anna, input, { timeoutMs = 25000 } = {}) {
  return request(
    anna,
    buildRehearsalMessages(input),
    REHEARSAL_MAX_TOKENS,
    parseRehearsal,
    timeoutMs,
  );
}
