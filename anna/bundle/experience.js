import { parsePreparation } from "./preparation.js";

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
    plan: null,
    source: null,
    invalidDraft: false,
  };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return out;
  out.input.event = cap(payload.context, 600);
  out.input.goal = cap(payload.goal, 300);
  out.input.keyPoint = cap(payload.key_point ?? payload.keyPoint, 220);
  out.input.preserve = cap(payload.preserve, 220);
  if (!out.input.event) return out;
  const draft = payload.preparation;
  if (draft === undefined || draft === null) return out;
  out.invalidDraft = true;
  if (typeof draft !== "object" || Array.isArray(draft)) return out;
  let parsed = null;
  try {
    parsed = parsePreparation(JSON.stringify(draft), { clarificationUsed: true });
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.kind !== "plan") return out;
  out.invalidDraft = false;
  out.source = "anna-handoff";
  out.plan = {
    opening: parsed.opening,
    keyPoint: parsed.keyPoint,
    approach: parsed.approach,
    objection: parsed.objection,
    response: parsed.response,
    nextStep: parsed.nextStep,
  };
  return out;
}
