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

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const HOUR_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";

export const PLAN_FACT_FIELDS = ["opening", "keyPoint", "approach", "objection", "response", "nextStep"];
export const REHEARSAL_FACT_FIELDS = ["adjustment", "response", "nextStep"];
export const NEUTRAL_OBJECTION = "What makes this hard?";

function scrubCompounds(text) {
  return String(text || "").replace(/\b[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+\b/gu, " ");
}

function timeTokens(text) {
  const found = [];
  const lower = String(text || "").toLowerCase();
  const patterns = [
    /\b(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?m\.?\b/g,
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/g,
    new RegExp(`\\bat\\s+(\\d{1,2}|${HOUR_WORDS})\\b`, "g"),
  ];
  for (const re of patterns) {
    for (const match of lower.matchAll(re)) found.push(match[0].replace(/\s+/g, " ").trim());
  }
  return found;
}

/** Counts, weekdays, and clock times. Number words inside hyphenated compounds (one-on-one) are ignored. */
export function ungroundedSpans(candidate, source) {
  const srcNums = new Set();
  const srcDays = new Set();
  const addNums = (text, into) => {
    const scrubbed = scrubCompounds(text).toLowerCase();
    for (const [word, n] of Object.entries(NUMBER_WORDS)) {
      if (new RegExp(`\\b${word}\\b`).test(scrubbed)) into.add(n);
    }
    for (const match of String(text || "").matchAll(/\b\d+\b/g)) into.add(Number(match[0]));
  };
  const src = String(source || "");
  addNums(src, srcNums);
  for (const day of WEEKDAYS) {
    if (new RegExp(`\\b${day}\\b`, "i").test(src)) srcDays.add(day);
  }
  const srcTimes = new Set(timeTokens(src));
  const found = [];
  const cand = String(candidate || "");
  const scrubbed = scrubCompounds(cand).toLowerCase();
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(scrubbed) && !srcNums.has(n)) found.push(word);
  }
  for (const match of cand.matchAll(/\b\d+\b/g)) {
    if (!srcNums.has(Number(match[0]))) found.push(match[0]);
  }
  const lower = cand.toLowerCase();
  for (const day of WEEKDAYS) {
    if (new RegExp(`\\b${day}\\b`).test(lower) && !srcDays.has(day)) found.push(day);
  }
  for (const time of timeTokens(cand)) {
    if (!srcTimes.has(time)) found.push(time);
  }
  return [...new Set(found)];
}

export function faithfulnessIssues(fields, source, keys) {
  const issues = [];
  for (const fieldName of keys) {
    const spans = ungroundedSpans(fields?.[fieldName] || "", source);
    if (spans.length) issues.push({ field: fieldName, spans });
  }
  return issues;
}

export function withholdUngrounded(fields, issues) {
  const next = { ...fields };
  for (const issue of issues) {
    next[issue.field] = issue.field === "objection" ? NEUTRAL_OBJECTION : "";
  }
  return next;
}

const FACT_LABELS = {
  opening: "opening",
  keyPoint: "key point",
  approach: "approach",
  objection: "pushback",
  response: "response",
  nextStep: "next step",
  adjustment: "adjustment",
};

function spanKind(span) {
  const text = String(span || "").toLowerCase();
  if (WEEKDAYS.includes(text)) return "weekday";
  if (/\d:\d|\b[ap]\.?m\b|\bat\b/.test(text) || timeTokens(text).length > 0) return "time";
  return "count";
}

export function faithfulnessMessage(issues) {
  const sentences = issues.map((issue) => {
    const kinds = [...new Set(issue.spans.map(spanKind))].map((kind) => `a ${kind}`);
    const label = FACT_LABELS[issue.field] || issue.field;
    return `${label[0].toUpperCase()}${label.slice(1)} added ${kinds.join(" and ")} you didn't write`;
  });
  return `${sentences.join(". ")}. Those lines were left blank. Write them in your own words.`.slice(0, 300);
}

export function groundedSpans(candidate, source) {
  const blocked = new Set(ungroundedSpans(candidate, source));
  const kept = [];
  const scrubbed = scrubCompounds(candidate).toLowerCase();
  for (const word of Object.keys(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(scrubbed) && !blocked.has(word)) kept.push(word);
  }
  for (const match of String(candidate || "").matchAll(/\b\d+\b/g)) {
    if (!blocked.has(match[0])) kept.push(match[0]);
  }
  const lower = String(candidate || "").toLowerCase();
  for (const day of WEEKDAYS) {
    if (new RegExp(`\\b${day}\\b`).test(lower) && !blocked.has(day)) kept.push(day);
  }
  for (const time of timeTokens(candidate)) {
    if (!blocked.has(time)) kept.push(time);
  }
  return [...new Set(kept)];
}

export const SCHEDULE_QUESTION = "You mentioned a deadline in the same week. Which day should the card name, if any?";

export function scheduleQuestion(source) {
  const text = String(source || "");
  const mentions = /\bdeadline\b/i.test(text) && /\b(?:same|this|the) week\b/i.test(text);
  const hasDay = WEEKDAYS.some((day) => new RegExp(`\\b${day}\\b`, "i").test(text));
  if (mentions && !hasDay && timeTokens(text).length === 0) return SCHEDULE_QUESTION;
  return null;
}

export function quotesReply(adjustment, reply) {
  const words = String(reply || "").toLowerCase().match(/[a-z0-9']+/g) || [];
  const hay = String(adjustment || "").toLowerCase();
  if (!words.length || !hay.trim()) return false;
  if (words.length < 3) return hay.includes(words.join(" "));
  for (let i = 0; i <= words.length - 3; i += 1) {
    if (hay.includes(words.slice(i, i + 3).join(" "))) return true;
  }
  return false;
}

export function sayableParagraph({ opening = "", keyPoint = "", nextStep = "" } = {}) {
  return [opening, keyPoint, nextStep].map((part) => String(part || "").trim()).filter(Boolean).join("\n\n");
}

export function preparationSource(input = {}) {
  const clarification = input.clarification;
  return [input.event, input.goal, input.keyPoint, input.preserve, clarification?.question, clarification?.answer]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n");
}

export function rehearsalSource(input = {}) {
  return [preparationSource(input), input.reply].filter((part) => typeof part === "string" && part.trim()).join("\n");
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
