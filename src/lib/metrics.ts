/**
 * The wire — the only thing that may leave a device.
 *
 * `events.ts` is the privacy contract; this is its enforcement. An event not
 * named in `WIRE` is never sent, and a value that isn't a number, a boolean
 * or an id-shaped string is dropped before the request is made — so a free
 * sentence can't ride along even if a caller tries. The counter
 * (netlify/functions/metrics.mjs) keeps daily aggregates only, which is the
 * other half of the same promise, and the two maps are pinned equal by
 * `__tests__/metrics.test.ts`.
 */
import { trackEvent } from "./analytics";

const METRICS_ENDPOINT = "/api/metrics";

type Kind = "num" | "bool" | "id";

type Fields = Partial<Record<Kind, readonly string[]>>;

/**
 * The D7 read needs four things: who arrived for the first time, who came
 * back and after how many days, whether the breath was reached, and how the
 * room felt afterwards. The qualitative bar needs a fifth: whether anyone
 * wrote a sentence of their own. Nothing else is wired — in particular the
 * copy and share events, which belong to E2 and wait for its arm flag.
 */
export type WiredEvent =
  | "visit"
  | "session_start"
  | "session_complete"
  | "session_abandon"
  | "after_answer"
  | "words_card_shown"
  | "words_written";

export const WIRE: Record<WiredEvent, Fields> = {
  visit: { num: ["days_since_first", "days_since_last"] },
  session_start: { id: ["pattern", "mode"] },
  session_complete: { id: ["pattern"], num: ["seconds", "cycles"] },
  session_abandon: { id: ["pattern", "phase"], num: ["seconds"] },
  after_answer: { id: ["choice"], num: ["material_changes"] },
  words_card_shown: { id: ["surface", "arm"] },
  words_written: { id: ["surface", "arm"], bool: ["for_me"] },
};

/** Catalog ids look like this; a sentence never does. */
const ID_SHAPE = /^[a-z][a-z0-9_-]{0,23}$/;

/** One shape both sides of the wire can read. */
export function wireFields(name: WiredEvent): Array<[string, Kind]> {
  const spec = WIRE[name];
  return [
    ...(spec.num ?? []).map((key) => [key, "num"] as [string, Kind]),
    ...(spec.bool ?? []).map((key) => [key, "bool"] as [string, Kind]),
    ...(spec.id ?? []).map((key) => [key, "id"] as [string, Kind]),
  ];
}

function clean(
  name: WiredEvent,
  props: Record<string, unknown>,
): Record<string, number | boolean | string> | null {
  const out: Record<string, number | boolean | string> = {};
  for (const [key, kind] of wireFields(name)) {
    const value = props[key];
    if (kind === "num" && typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e9) {
      out[key] = Math.round(value);
    }
    if (kind === "bool" && typeof value === "boolean") out[key] = value;
    if (kind === "id" && typeof value === "string" && ID_SHAPE.test(value)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function isWired(name: string): name is WiredEvent {
  return Object.hasOwn(WIRE, name);
}

export function sendMetrics(name: string, props: Record<string, unknown>): void {
  if (typeof window === "undefined" || !isWired(name)) return;
  const payload = clean(name, props);
  if (!payload) return;
  try {
    window
      .fetch(METRICS_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, props: payload }),
        keepalive: true,
      })
      .catch(() => {});
  } catch {
    // Measurement must never interrupt the product.
  }
}

/** The sink both halves of the promise run through. */
export function record(name: string, props: Record<string, unknown>): void {
  trackEvent(name, props);
  sendMetrics(name, props);
}
