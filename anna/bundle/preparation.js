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

/** Counts, weekdays, dates, clock times — and names. Number words inside hyphenated compounds (one-on-one) are ignored. A capitalised token that is not an allowed sentence opener and is not in the person's words is an invented name, withheld like an ungrounded count. */
export function ungroundedSpans(candidate, source) {
  const src = sourceFacts(source);
  const words = sourceWords(source);
  const found = [];
  for (const fact of scanFacts(candidate)) {
    if (!isGrounded(fact, src)) found.push(fact.token);
  }
  for (const ent of scanEntities(candidate)) {
    if (!words.has(ent.token.toLowerCase())) found.push(ent.token);
  }
  // A fact word ("Friday") is also a capitalised token; the fact span is
  // pushed first, so case-insensitive dedup keeps it and drops the name dupe.
  const seen = new Set();
  const out = [];
  for (const token of found) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
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
  const raw = String(span || "");
  const text = raw.toLowerCase();
  if (WEEKDAYS.includes(text)) return "weekday";
  if (MONTHS.includes(text) || /^\d{1,2}(st|nd|rd|th)$/.test(text)) return "date";
  if (/\d:\d|\b[ap]\.?m\b|\bat\b/.test(text) || timeSpans(text).length > 0) return "time";
  if (REL_DAY_WORDS.includes(text) || phraseSpans(text).length > 0) return "time";
  if (/^[A-Z]/.test(raw)) return "name";
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

// --- Entity gate -----------------------------------------------------------
// A card may only name people the person named. The fact scanner knows
// counts and dates, not names, so a draft that invents "Priya" passes the
// fact gate untouched. This closes that: every capitalised token in a
// draft field must either open the sentence with a common opener (below)
// or appear in the person's own words. Anything else is an invented name
// and the field is withheld, exactly like an ungrounded count. The same
// opener sets drive maskReference, so the suggestion and the gate agree.
//
// The signal is a CLOSED set, deliberately: it errs toward flagging (a
// rare opener is withheld and retried — the safe direction), never toward
// exempting. A frequency list was prototyped as the opener signal and
// rejected: corpus frequency lists are full of proper names (john@372,
// sam@3386, sarah@3524…), so they would exempt invented names and leak
// them into the saved card. See scripts/audit-openers.mjs — frequency is
// used only OFFLINE to audit the open tier for gaps, never at runtime.
//
// Two tiers, honest about which is complete:
//   FUNCTION_WORDS — the finite grammatical core (pronouns, determiners,
//     prepositions, conjunctions, auxiliaries/modals, question words).
//     Enumerable and complete; none are names except the modals Will/May.
//   CARD_OPENERS — the open lexical class (imperative verbs, situation
//     nouns, discourse markers). Best-effort and audited; the retry covers
//     the tail. The only names here are deliberate common openers (Hope).
// The bounded name-leak surface is exactly {Will, May, Hope}: each is a
// frequent legitimate opener ("Will you…", "May I…", "Hope you're well"),
// so exempting them trades a tiny sentence-initial risk for readable cards.

// First-person pronouns are never names.
const REFERENCE_KEEP = new Set(["I", "I'm", "I'll", "I've", "I'd", "I’m", "I’ll", "I’ve", "I’d"]);

// The finite grammatical core. Complete by enumeration — these classes do
// not grow. Contractions match on their base ("It's" -> "It") via isOpener.
// Will/May are modals that double as names; that trade is documented above.
export const FUNCTION_WORDS = new Set([
  // pronouns + possessives + reflexives
  "I", "Me", "My", "Mine", "Myself", "You", "Your", "Yours", "Yourself", "Yourselves",
  "He", "Him", "His", "Himself", "She", "Her", "Hers", "Herself",
  "It", "Its", "Itself", "We", "Us", "Our", "Ours", "Ourselves",
  "They", "Them", "Their", "Theirs", "Themselves",
  "This", "That", "These", "Those", "There", "Here",
  // determiners + quantifiers
  "The", "A", "An", "One", "Some", "Any", "No", "Every", "Each", "Either", "Neither",
  "Both", "All", "Few", "Fewer", "Many", "Much", "More", "Most", "Several", "Enough", "Such",
  // auxiliary + modal verbs
  "Am", "Is", "Are", "Was", "Were", "Be", "Been", "Being",
  "Have", "Has", "Had", "Having", "Do", "Does", "Did", "Done", "Doing",
  "Will", "Would", "Shall", "Should", "Can", "Could", "May", "Might", "Must", "Ought", "Used",
  // question words
  "What", "When", "Where", "Which", "Who", "Whom", "Whose", "Why", "How",
  // conjunctions
  "And", "But", "Or", "Nor", "So", "Yet", "If", "Because", "Since", "While", "Whilst",
  "After", "Before", "Once", "Until", "Unless", "Though", "Although", "Whether", "Whereas",
  "Whenever", "Wherever",
  // prepositions
  "About", "Above", "Across", "After", "Against", "Along", "Among", "Around", "As", "At",
  "Before", "Behind", "Below", "Beneath", "Beside", "Between", "Beyond", "By", "Down",
  "During", "Except", "For", "From", "In", "Inside", "Into", "Like", "Near", "Of", "Off",
  "On", "Onto", "Out", "Outside", "Over", "Past", "Than", "Through", "Throughout", "To",
  "Toward", "Towards", "Under", "Underneath", "Until", "Up", "Upon", "With", "Within", "Without",
]);

// The open lexical class: imperative verbs, situation nouns, discourse
// markers. Best-effort, kept complete by scripts/audit-openers.mjs (offline
// frequency audit) plus the one retry. A rare opener missed here is withheld
// and retried — never leaked. "Hope" is a discourse marker that doubles as a
// name; the same documented trade as Will/May.
export const CARD_OPENERS = new Set([
  // imperative / lexical verbs that open a card line
  "Tell", "Ask", "Say", "Keep", "Meet", "Let", "Try", "Start", "Begin", "Open",
  "Close", "Give", "Take", "Make", "Get", "Put", "Set", "Bring", "Send", "Share",
  "Show", "Explain", "Describe", "Suggest", "Propose", "Offer", "Request",
  "Confirm", "Check", "Clarify", "Focus", "Lead", "End", "Follow", "Move",
  "Hold", "Leave", "Stay", "Wait", "Pause", "Breathe", "Remember", "Consider",
  "Think", "Look", "Listen", "Notice", "Acknowledge", "Name", "See", "Talk",
  "Push", "Due", "Discuss", "Review", "Plan", "Schedule", "Arrange", "Prepare",
  "Present", "Pitch", "Raise", "Mention", "Note", "Add", "Cover", "Address",
  "Handle", "Negotiate", "Agree", "Decide", "Choose", "Pick", "Select", "Find",
  "Build", "Create", "Write", "Draft", "Read", "Call", "Email", "Message",
  "Contact", "Reach", "Invite", "Join", "Attend", "Cancel", "Reschedule",
  "Postpone", "Delay", "Defer", "Split", "Divide", "Assign", "Delegate",
  "Escalate", "Flag", "Highlight", "Emphasize", "Stress", "Summarize", "Recap",
  "Wrap", "Finish", "Complete", "Submit", "Deliver", "Ship", "Launch", "Release",
  "Update", "Revise", "Edit", "Adjust", "Change", "Modify", "Improve", "Fix",
  "Resolve", "Solve", "Answer", "Reply", "Respond", "Walk", "Run", "Stand",
  "Sit", "Feel", "Hear", "Speak", "State", "Express", "Voice", "Recommend",
  "Advise", "Guide", "Direct", "Manage", "Organize", "Organise", "Coordinate",
  "Align", "Verify", "Validate", "Test", "Measure", "Track", "Monitor", "Watch",
  "Observe", "Reflect", "Rest", "Relax", "Slow", "Stop", "Continue", "Proceed",
  "Resume", "Return", "Come", "Go", "Maintain", "Preserve", "Protect", "Save",
  "Store", "Record", "Log", "Document", "Report", "Define", "Outline", "Detail",
  "Specify", "Identify", "Recognize", "Appreciate", "Value", "Respect", "Trust",
  "Believe", "Wish", "Want", "Need", "Prefer",
  // verbs added from the offline opener audit (common, not names)
  "Help", "Use", "Know", "Support", "Order", "List", "View", "Include",
  "Apologize", "Reassure", "Empathize",
  // situation nouns that open a relay ("Interview tomorrow", "Meeting with…")
  "Interview", "Meeting", "Panel", "Conversation", "Discussion", "Chat", "Sync",
  "Standup", "Presentation", "Negotiation", "Demo", "Workshop", "Session",
  "Briefing", "Debrief", "Hearing", "Appeal", "Mediation", "Debate", "Status",
  "Planning", "Strategy", "Budget", "Salary", "Promotion", "Feedback",
  "Performance", "Appraisal", "Confrontation", "Argument", "Exchange",
  "Follow-up", "Catch-up", "Check-in",
  // situation nouns added from the offline opener audit (common, not names)
  "Time", "People", "Business", "Management", "Group", "Company", "Program",
  "Research", "Information", "Audit", "Assessment", "Evaluation", "Arbitration", "Tribunal",
  // discourse markers, greetings, common adverbs/adjectives
  "Thank", "Thanks", "Please", "Sorry", "Hi", "Hey", "Hello", "Welcome",
  "Then", "Next", "First", "Finally", "Also", "Now", "Maybe", "Perhaps",
  "Yes", "Not", "Never", "Always", "Sometimes", "Often", "Still", "Even",
  "Just", "Only", "Good", "Great", "Nice", "Hope", "Well", "Sure", "Right",
  "Okay", "Honestly", "Actually", "Basically", "Clearly", "Obviously", "Really",
  // discourse markers added from the offline opener audit (not names)
  "Top", "Full", "Personally", "Frankly", "Surely", "Certainly", "Hopefully",
  "Fortunately", "Thankfully", "Unfortunately", "Sadly", "Interestingly", "Importantly",
]);

const SENTENCE_OPENERS = new Set([...FUNCTION_WORDS, ...CARD_OPENERS]);

function opensSentence(text, offset) {
  const before = String(text).slice(0, offset);
  return !before.trim() || /[.!?…,;:]\s*$/.test(before);
}

// An allowed opener, matching contractions on their base ("It's" -> "It").
function isOpener(word) {
  if (SENTENCE_OPENERS.has(word)) return true;
  const base = word.split(/['’]/)[0];
  return base !== word && SENTENCE_OPENERS.has(base);
}

// Capitalised tokens that are not first-person pronouns and not allowed
// sentence openers — candidate names, with the span they occupy.
export function scanEntities(text) {
  const src = String(text || "");
  const out = [];
  for (const m of src.matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
    const word = m[0];
    if (!/^[A-Z]/.test(word) || word.length < 2 || REFERENCE_KEEP.has(word)) continue;
    if (opensSentence(src, m.index) && isOpener(word)) continue;
    out.push({ kind: "name", token: word, start: m.index, end: m.index + word.length });
  }
  return out;
}

function sourceWords(text) {
  const out = new Set();
  for (const m of String(text || "").matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
    out.add(m[0].toLowerCase());
  }
  return out;
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

// --- Masked reference ------------------------------------------------------
// Everything the model writes — the brume_prepare relay, the draft it
// used to send, Anna's reading on screen — is model prose: every
// argument is model-written and the protocol offers no transcript to
// check it against. Model text is therefore never the card's source and
// is never shown raw: on screen it appears only through maskReference,
// which hides every scanned fact AND every capitalised token that is not
// an allowed sentence opener (names like "Priya" are not facts the scanner
// knows, but they are still the model's words). A name that opens a line
// masks too — only the closed opener set survives. scanFacts stays the
// shared fact vocabulary (the faithfulness gate uses it).

// The text with every asserted fact masked.
export function maskFacts(text) {
  const body = String(text || "");
  const facts = scanFacts(body).sort((a, b) => b.start - a.start);
  let out = body;
  for (const fact of facts) {
    out = out.slice(0, fact.start) + "…" + out.slice(fact.end);
  }
  return out.replace(/\s+/g, " ").trim();
}

// Model prose safe to show as reference: facts masked, and capitalised
// words masked too unless they open a sentence with an allowed opener.
// Only real sentence boundaries keep a capital: a quote or bracket does
// not, so '(Priya' and '"Priya' mask like any other name — and so does a
// name that opens the line ("Priya needs…"), which is not an opener.
export function maskReference(text) {
  const body = maskFacts(text);
  return body.replace(/[A-Za-z][A-Za-z'’-]*/g, (word, offset) => {
    if (!/^[A-Z]/.test(word) || word.length < 2 || REFERENCE_KEEP.has(word)) return word;
    if (opensSentence(body, offset) && isOpener(word)) return word;
    return "…";
  });
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
