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
// "first"/"second" are excluded: they are too common as discourse markers
// (and "second" is a time unit) to flag safely. Hyphenated ordinals like
// "twenty-first" are scrubbed with the other compounds.
const ORDINAL_WORDS = {
  third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14,
  fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20, thirtieth: 30,
};
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
];
const REL_DAY_WORDS = ["today", "tomorrow", "tonight", "yesterday", "noon", "midday", "midnight", "weekend"];
const HOUR_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const ORDINAL_RE = /\b(\d{1,2})(st|nd|rd|th)\b/gi;
const OCLOCK_RE = new RegExp(`\\b(\\d{1,2}|${HOUR_WORDS})\\s*o'?clock\\b`, "gi");
const VAGUE_COUNT_RES = [
  /\ba\s+couple\b/gi,
  /\ba\s+few\b/gi,
  /\ba\s+dozen\b/gi,
  /\bseveral\b/gi,
];
const REL_SPAN_RES = [
  /\bthis\s+(?:morning|afternoon|evening|week|month|weekend)\b/gi,
  /\bnext\s+(?:week|month|year|weekend)\b/gi,
  /\blast\s+(?:week|month|year|night|weekend)\b/gi,
  /\b(?:the\s+)?same\s+(?:week|weekend|month|day)\b/gi,
  /\bin\s+the\s+(?:morning|afternoon|evening)\b/gi,
  /\bend\s+of\s+(?:the\s+)?(?:day|week|month)\b/gi,
];

export const PLAN_FACT_FIELDS = ["opening", "keyPoint", "approach", "objection", "response", "nextStep"];
export const REHEARSAL_FACT_FIELDS = ["adjustment", "response", "nextStep"];
export const NEUTRAL_OBJECTION = "What makes this hard?";

// Hyphenated compounds ("one-on-one", "twenty-first") are not facts.
// The scanner skips every match inside one and keeps the offsets of the
// original text, so a fact can be replaced in place.
function compoundRanges(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/\b[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+\b/gu)) {
    out.push([m.index, m.index + m[0].length]);
  }
  return out;
}

function inRanges(start, end, ranges) {
  for (const [a, b] of ranges) if (start >= a && end <= b) return true;
  return false;
}

function timeSpans(text) {
  const found = [];
  const lower = String(text || "").toLowerCase();
  const patterns = [
    /\b(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?m\.?\b/g,
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/g,
    new RegExp(`\\bat\\s+(\\d{1,2}|${HOUR_WORDS})\\b`, "g"),
  ];
  for (let i = 0; i < patterns.length; i += 1) {
    for (const match of lower.matchAll(patterns[i])) {
      // "at 3 o'clock" belongs to the o'clock phrase, not "at 3".
      if (i === 2 && /^\s*o'?clock\b/.test(lower.slice(match.index + match[0].length))) continue;
      found.push({
        token: match[0].replace(/\s+/g, " ").trim(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return found;
}

function phraseSpans(text) {
  const lower = String(text || "").toLowerCase();
  const skip = compoundRanges(text);
  const found = [];
  for (const re of [...VAGUE_COUNT_RES, ...REL_SPAN_RES, OCLOCK_RE]) {
    for (const match of lower.matchAll(re)) {
      if (inRanges(match.index, match.index + match[0].length, skip)) continue;
      const token = match[0].replace(/\s+/g, " ").trim();
      // "the same week" and "this week" are one span — restating it is
      // not a new fact, so both surfaces fold to a single token.
      found.push({
        token: token.replace(/^(?:the\s+)?same\s+(week|weekend|month|day)$/i, "this $1"),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return found;
}

/**
 * Every fact a card could assert, with the span it occupies.
 *
 * The kinds are the whole shared vocabulary: counts, ordinals, weekdays,
 * clock times, relative day words, months and schedule/count phrases.
 * The order is the order the faithfulness message reads them in.
 *
 * This is the contract the Python plugin mirrors (brume_plugin.py) — the
 * chat path asks the person for each fact it finds, so the two scanners
 * must agree. Pinned by the "fact_scan" section of test/plan-cases.json.
 */
export function scanFacts(text) {
  const src = String(text || "");
  const lower = src.toLowerCase();
  const skip = compoundRanges(src);
  const facts = [];
  const add = (kind, token, value, start, end, scrubbed) => {
    if (scrubbed && inRanges(start, end, skip)) return;
    facts.push({ kind, token, value, start, end });
  };
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    for (const m of lower.matchAll(new RegExp(`\\b${word}\\b`, "g"))) {
      add("count", m[0], n, m.index, m.index + m[0].length, true);
    }
  }
  for (const m of src.matchAll(/\b\d+\b/g)) {
    add("count", m[0], Number(m[0]), m.index, m.index + m[0].length, false);
  }
  for (const m of src.matchAll(ORDINAL_RE)) {
    add("ordinal", m[0].toLowerCase(), Number(m[1]), m.index, m.index + m[0].length, false);
  }
  for (const [word, n] of Object.entries(ORDINAL_WORDS)) {
    for (const m of lower.matchAll(new RegExp(`\\b${word}\\b`, "g"))) {
      add("ordinal", m[0], n, m.index, m.index + m[0].length, true);
    }
  }
  for (const day of WEEKDAYS) {
    for (const m of lower.matchAll(new RegExp(`\\b${day}\\b`, "g"))) {
      add("weekday", m[0], day, m.index, m.index + m[0].length, true);
    }
  }
  for (const t of timeSpans(src)) add("time", t.token, t.token, t.start, t.end, false);
  for (const word of REL_DAY_WORDS) {
    for (const m of lower.matchAll(new RegExp(`\\b${word}\\b`, "g"))) {
      add("relative", m[0], word, m.index, m.index + m[0].length, true);
    }
  }
  for (const word of MONTHS) {
    for (const m of lower.matchAll(new RegExp(`\\b${word}\\b`, "g"))) {
      add("month", m[0], word, m.index, m.index + m[0].length, true);
    }
  }
  for (const p of phraseSpans(src)) add("phrase", p.token, p.token, p.start, p.end, true);
  return facts;
}

function sourceFacts(text) {
  // Every fact token a candidate may reuse: numbers, ordinals, weekdays,
  // clock times, months, relative day words and schedule/count phrases.
  const out = {
    counts: new Set(),
    ordinals: new Set(),
    weekdays: new Set(),
    relatives: new Set(),
    times: new Set(),
    phrases: new Set(),
  };
  for (const f of scanFacts(text)) {
    if (f.kind === "count") out.counts.add(f.value);
    else if (f.kind === "ordinal") {
      out.ordinals.add(f.value);
      out.counts.add(f.value);
    } else if (f.kind === "weekday") out.weekdays.add(f.value);
    else if (f.kind === "relative" || f.kind === "month") out.relatives.add(f.value);
    else if (f.kind === "time") out.times.add(f.value);
    else if (f.kind === "phrase") out.phrases.add(f.value);
  }
  return out;
}

function isGrounded(fact, src) {
  if (fact.kind === "count") return src.counts.has(fact.value);
  if (fact.kind === "ordinal") return src.ordinals.has(fact.value);
  if (fact.kind === "weekday") return src.weekdays.has(fact.value);
  if (fact.kind === "relative" || fact.kind === "month") return src.relatives.has(fact.value);
  if (fact.kind === "time") return src.times.has(fact.value);
  if (fact.kind === "phrase") return src.phrases.has(fact.value);
  return false;
}

/** Counts, weekdays, dates, and clock times. Number words inside hyphenated compounds (one-on-one) are ignored. */
export function ungroundedSpans(candidate, source) {
  const src = sourceFacts(source);
  const found = [];
  for (const fact of scanFacts(candidate)) {
    if (!isGrounded(fact, src)) found.push(fact.token);
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
  if (MONTHS.includes(text) || /^\d{1,2}(st|nd|rd|th)$/.test(text)) return "date";
  if (/\d:\d|\b[ap]\.?m\b|\bat\b/.test(text) || timeSpans(text).length > 0) return "time";
  if (REL_DAY_WORDS.includes(text) || phraseSpans(text).length > 0) return "time";
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
  const src = sourceFacts(source);
  const kept = [];
  for (const fact of scanFacts(candidate)) {
    if (isGrounded(fact, src)) kept.push(fact.token);
  }
  return [...new Set(kept)];
}

const DAYISH_RE = new RegExp(
  `\\b(?:${WEEKDAYS.join("|")})\\b` +
    "|\\b(?:today|tomorrow|tonight|yesterday|noon|midday|midnight)\\b" +
    `|\\b(?:${MONTHS.join("|")})\\b` +
    "|\\b(?:this|next|last)\\s+(?:morning|afternoon|evening|night)\\b" +
    "|\\bin\\s+the\\s+(?:morning|afternoon|evening)\\b",
  "i",
);

function hasDayOrTime(text) {
  // True when the text names a specific day or time (not just a span
  // like "this week"). Mirror of the plugin's _has_day_or_time.
  const t = String(text || "");
  if (DAYISH_RE.test(t)) return true;
  if (t.match(ORDINAL_RE) || t.match(OCLOCK_RE)) return true;
  return timeSpans(t).length > 0;
}

export const SCHEDULE_QUESTION = "You mentioned a deadline in the same week. Which day should the card name, if any?";

export function scheduleQuestion(source) {
  const text = String(source || "");
  const mentions = /\bdeadline\b/i.test(text) && /\b(?:same|this|the) week\b/i.test(text);
  if (mentions && !hasDayOrTime(text)) return SCHEDULE_QUESTION;
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
