
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
  const out = {
    input: { event: "", goal: "", keyPoint: "", kind: null, preserve: "" },
  };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return out;
  out.input.event = cap(payload.context, 600);
  out.input.goal = cap(payload.goal, 300);
  out.input.keyPoint = cap(payload.key_point ?? payload.keyPoint, 220);
  out.input.preserve = cap(payload.preserve, 220);
  return out;
}
