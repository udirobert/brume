/**
 * Read-only sibling of metrics.mjs: returns the last N day documents from
 * the same daily-aggregate store, so retention can be read without opening
 * the Netlify Blobs console.
 *
 * Closed by default — set METRICS_READOUT_KEY in the Netlify env and pass
 * it as ?key=. Without the env var, or with the wrong key, this is a 404:
 * the counters are aggregates, but they are still ours to share or not.
 *
 * Day shape (written by metrics.mjs):
 *   { day, since_first: {bucket: n}, gaps: {bucket: n}, session_starts,
 *     completes: {pattern: n}, abandons, answers: {id: n},
 *     words_card: {shown, written}, events }
 */
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const key = process.env.METRICS_READOUT_KEY;
  const given = new URL(req.url).searchParams.get("key");
  if (!key || given !== key) {
    return new Response("Not found", { status: 404 });
  }

  const days = Math.min(
    90,
    Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30),
  );
  const store = getStore("brume-metrics");
  const { blobs } = await store.list();
  const keys = blobs
    .map((b) => b.key)
    .filter((k) => /^day-\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .slice(-days);

  const out = [];
  for (const k of keys) {
    const doc = await store.get(k, { type: "json" });
    if (doc) out.push(doc);
  }

  // The question the readout exists for: do people come back?
  // days_since_last === 1 in `gaps` is a return visit the next day.
  const summary = out.reduce(
    (acc, d) => {
      acc.visits += d.since_first ? Object.values(d.since_first).reduce((a, b) => a + b, 0) : 0;
      acc.returns_next_day += d.gaps?.["1"] ?? 0;
      acc.sessions += d.session_starts ?? 0;
      acc.completes += Object.values(d.completes ?? {}).reduce((a, b) => a + b, 0);
      return acc;
    },
    { visits: 0, returns_next_day: 0, sessions: 0, completes: 0 },
  );

  return Response.json({ days: out, summary });
};

export const config = { path: "/api/metrics-readout" };
