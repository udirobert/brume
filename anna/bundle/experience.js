
export const MOMENTS = {
  deadline: { event: "I need to push back on a deadline.", kind: "hard-conversation", placeholder: "What is due, and what is realistic?" },
  support: { event: "I need to ask for support.", kind: "meeting", placeholder: "Who are you asking, and what help do you need?" },
  feedback: { event: "I need to give difficult feedback.", kind: "hard-conversation", placeholder: "What happened, and who will you speak with?" },
  interview: { event: "I am preparing for an interview.", kind: "interview", placeholder: "What role or question would you like to prepare for?" },
};
export const WORDING_STYLES = ["natural", "concise", "direct"];
export const normaliseWordingStyle = (value) => WORDING_STYLES.includes(value) ? value : "natural";

const cap = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";

// The card fields a brume_prepare draft can carry — mirror of
// CARD_FACT_FIELDS / _CARD_CAPS in preparation.js and brume_plugin.py.
const INTERVIEW_FIELDS = {
  opening: 300, keyPoint: 220, approach: 300,
  objection: 240, response: 360, nextStep: 220,
};
// The draft brume_prepare hands to the window. Only the fields cross the
// wire: the window shows each one masked (maskFacts in preparation.js)
// and the person writes every part themselves — the draft is reference
// only. Anything malformed is dropped — a draft the window cannot honour
// is worse than none.
export function parseInterview(payload) {
  const iv = payload?.interview;
  if (!iv || typeof iv !== "object" || Array.isArray(iv)) return null;
  const fields = {};
  for (const [key, limit] of Object.entries(INTERVIEW_FIELDS)) {
    const v = cap(iv.fields?.[key], limit);
    if (v) fields[key] = v;
  }
  if (!fields.opening && !fields.keyPoint) return null;
  return { fields };
}

export function parseReadyHandoff(payload) {
  // Anna's reading of the person's message. It is a SUGGESTION, never
  // the source: the card's content is grounded in what the person writes
  // in the form or types in the interview, so the suggestion never lands
  // in the fields.
  const out = { suggestion: { event: "", goal: "", keyPoint: "", preserve: "" }, interview: null };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return out;
  out.suggestion.event = cap(payload.context, 600);
  out.suggestion.goal = cap(payload.goal, 300);
  out.suggestion.keyPoint = cap(payload.key_point ?? payload.keyPoint, 220);
  out.suggestion.preserve = cap(payload.preserve, 220);
  out.interview = parseInterview(payload);
  return out;
}
