// Reset routine definition + factual completion record.
// Dependency-free so the node smoke test can import it directly.

// One Reset-appropriate default: a comfortable 4s in / 6s out rhythm,
// 10s per cycle, 9 cycles ≈ 90 seconds total.
export const PATTERN = {
  name: "Reset · 4s in, 6s out",
  inhale: 4,
  hold: 0,
  exhale: 6,
  holdAfterExhale: 0,
};

export const TARGET_SECONDS = 90;

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
  hold: "Hold",
  exhale: "Breathe out",
  pause: "Rest",
};

// Factual record only — pattern, active seconds, cycles, timestamp, flag.
// No scores, no verification language.
export function buildCompletionRecord({ activeSeconds, cycles, interrupted, now }) {
  return {
    pattern: PATTERN.name,
    activeSeconds,
    cycles,
    completedAt: new Date(now).toISOString(),
    interrupted: Boolean(interrupted),
  };
}

function unwrap(res) {
  // SDK calls resolve {ok:true,result} or {ok:false,error}; some harness
  // paths reject instead. Normalize both to throw-on-failure.
  if (res && typeof res === "object" && res.ok === false) {
    const err = res.error || {};
    const e = new Error(err.message || "storage write failed");
    e.code = err.code;
    throw e;
  }
  return res;
}

// Writes the completion record to per-user APS KV via the host API.
// `anna` is the AnnaAppRuntime object (or a compatible test double).
// Throws on failure — the caller shows a "couldn't save" note.
export async function saveCompletionRecord(anna, record) {
  const key = `reset/sessions/${record.completedAt}`;
  await unwrap(
    anna.storage.set({ key, value: record, scope: "user" }),
  );
  await unwrap(
    anna.storage.set({ key: "reset/last", value: record, scope: "user" }),
  );
  return key;
}

export async function loadLastRecord(anna) {
  const res = await unwrap(
    anna.storage.get({ key: "reset/last", scope: "user" }),
  );
  return res && typeof res === "object" && "value" in res ? res.value : res;
}

// --- Closing line via anna.llm.complete ------------------------------------
//
// The successful llm.complete call is what makes a run server-observable
// (a storage.set alone does not count as a qualified run). The prompt is
// built ONLY from session facts — pattern, active seconds, cycles, and the
// interrupted flag. No user text or reflections ever reach the model.
// Any failure, timeout, denial, or absent SDK resolves to the fixed
// fallback line so the factual result always shows.

export const FALLBACK_CLOSING_LINE = "Take a moment before you begin again.";

const LLM_TIMEOUT_MS = 4000;
const LLM_MAX_TOKENS = 64; // one short line; far below the 8192 sync ceiling

export function buildClosingPrompt({ activeSeconds, cycles, interrupted }) {
  return [
    "You are writing the closing line shown after a guided breathing break.",
    "Session facts:",
    `- Routine: ${PATTERN.name}`,
    `- Active practice time: ${activeSeconds} seconds`,
    `- Breathing cycles completed: ${cycles}`,
    `- Ended early: ${interrupted ? "yes" : "no"}`,
    "Write one calm closing line or next-action suggestion.",
    "15 words or fewer, plain sentence text, no emoji.",
  ].join("\n");
}

// Accepts the llm.complete result ({role, content:{type:"text",text}}) or a
// raw {ok:false,error} envelope — normalize to a trimmed single-line string.
function closingText(res) {
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
  return text.replace(/\s+/g, " ").trim();
}

function withTimeout(promise, ms) {
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

// One call, no retries. Never throws — resolves to the model's line or the
// fixed fallback. `opts.timeoutMs` is for tests; production uses ~4s.
export async function fetchClosingLine(anna, facts, opts) {
  if (!anna || typeof anna.llm?.complete !== "function") {
    return FALLBACK_CLOSING_LINE;
  }
  const timeoutMs = opts?.timeoutMs ?? LLM_TIMEOUT_MS;
  try {
    const res = await withTimeout(
      Promise.resolve(
        anna.llm.complete({
          messages: [
            {
              role: "user",
              content: { type: "text", text: buildClosingPrompt(facts) },
            },
          ],
          maxTokens: LLM_MAX_TOKENS,
        }),
      ),
      timeoutMs,
    );
    return closingText(res) || FALLBACK_CLOSING_LINE;
  } catch {
    return FALLBACK_CLOSING_LINE;
  }
}
