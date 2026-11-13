
export const MOMENTS = {
  deadline: { event: "I need to push back on a deadline.", kind: "hard-conversation", placeholder: "What is due, and what is realistic?" },
  support: { event: "I need to ask for support.", kind: "meeting", placeholder: "Who are you asking, and what help do you need?" },
  feedback: { event: "I need to give difficult feedback.", kind: "hard-conversation", placeholder: "What happened, and who will you speak with?" },
  interview: { event: "I am preparing for an interview.", kind: "interview", placeholder: "What role or question would you like to prepare for?" },
};
export const WORDING_STYLES = ["natural", "concise", "direct"];
export const normaliseWordingStyle = (value) => WORDING_STYLES.includes(value) ? value : "natural";

const cap = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";

export function parseReadyHandoff(payload) {
  // Anna's reading of the person's message. It is a SUGGESTION, never
  // the source: the card's facts are grounded in what the person writes
  // in the form, so the suggestion never lands in the fields.
  const out = { suggestion: { event: "", goal: "", keyPoint: "", preserve: "" } };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return out;
  out.suggestion.event = cap(payload.context, 600);
  out.suggestion.goal = cap(payload.goal, 300);
  out.suggestion.keyPoint = cap(payload.key_point ?? payload.keyPoint, 220);
  out.suggestion.preserve = cap(payload.preserve, 220);
  return out;
}
