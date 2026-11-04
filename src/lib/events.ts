/**
 * Experiment events — anonymous, counts and catalog ids only.
 *
 * The type map IS the privacy contract: every property is a number, a
 * boolean, or a member of a closed set. There is no string field a
 * caller could put a user's words, a message, or a drawing into. Add an
 * event here (and to docs/EXPERIMENTS.md) before wiring it anywhere.
 *
 * Sink is `record` (metrics.ts): a same-origin counter that only accepts the
 * events named in `WIRE`, plus `trackEvent` for a provider, if one is loaded.
 */
import { record } from "./metrics";
import type { CheckInReasonId } from "./checkinLedger";
import type { CueState } from "./voiceCues";

type Surface = "post_session" | "decompress";
type Material = "mist" | "waves" | "sand" | "cells" | "snow" | "ink";

export interface BrumeEvents {
  session_start: { pattern: string; mode: string };
  session_complete: { pattern: string; seconds: number; cycles: number };
  session_abandon: { pattern: string; seconds: number; phase: "active" | "paused" };
  checkin_word: { feeling: number; surface: "home" | "decompress" };
  checkin_reason: { feeling: number; reason: CheckInReasonId };
  checkin_voice_used: { matched: boolean; offered: number | null };
  words_card_shown: { surface: Surface; arm: "sentence" };
  words_card_copied: { surface: Surface; arm: "sentence"; room_link: boolean; for_me: boolean; edited: boolean };
  words_card_shared: { surface: Surface; arm: "sentence"; room_link: boolean; for_me: boolean; edited: boolean };
  words_card_heard: { surface: Surface; edited: boolean };
  room_link_toggled: { surface: Surface; on: boolean };
  material_changed: { to: Material | "auto" };
  cue_changed: { from: CueState; to: CueState };
  landing_reached: { seconds: number };
  landing_resumed: Record<string, never>;
  landing_settled: Record<string, never>;
  after_answer: { choice: "lighter" | "same" | "heavy"; material_changes: number };
  room_touch: { strokes: number; seconds: number; material: Material };
  visit: { days_since_first: number; days_since_last?: number };
}

let materialChanges = 0;

export function track<K extends keyof BrumeEvents>(name: K, props: BrumeEvents[K]): void {
  try {
    if (name === "material_changed") materialChanges++;
    if (name === "after_answer") {
      (props as BrumeEvents["after_answer"]).material_changes = materialChanges;
      materialChanges = 0;
    }
    record(name, props as Record<string, unknown>);
  } catch {
    // Measurement must never interrupt the product.
  }
}

const FIRST_KEY = "brume/first-seen";
const LAST_KEY = "brume/last-visit";
const DAY_MS = 86_400_000;

const dayNumber = (d: Date) =>
  Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / DAY_MS);

/**
 * One `visit` per calendar day, carrying only two numbers: how many days
 * since the first visit, and how many since the previous one. The gap is
 * what answers "do people come back" without an id — no cookie, no device
 * key, nothing sent but the pair, and the counter keeps daily aggregates.
 */
export function recordVisit(now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    const today = dayNumber(now);
    const first = Number(window.localStorage.getItem(FIRST_KEY));
    const last = Number(window.localStorage.getItem(LAST_KEY));
    if (!Number.isFinite(first) || first <= 0) {
      window.localStorage.setItem(FIRST_KEY, String(today));
      window.localStorage.setItem(LAST_KEY, String(today));
      track("visit", { days_since_first: 0 });
      return;
    }
    if (last === today) return;
    window.localStorage.setItem(LAST_KEY, String(today));
    const previous = Number.isFinite(last) && last > 0 ? last : first;
    track("visit", {
      days_since_first: Math.max(0, today - first),
      days_since_last: Math.max(1, today - previous),
    });
  } catch {
    // Storage unavailable — skip silently.
  }
}
