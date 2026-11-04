/**
 * Experiment events — anonymous, counts and catalog ids only.
 *
 * The type map IS the privacy contract: every property is a number, a
 * boolean, or a member of a closed set. There is no string field a
 * caller could put a user's words, a message, or a drawing into. Add an
 * event here (and to docs/EXPERIMENTS.md) before wiring it anywhere.
 *
 * Sink is `trackEvent` (PostHog/Mixpanel if present, console in dev).
 */
import { trackEvent } from "./analytics";

type Surface = "post_session" | "decompress";
type Material = "mist" | "waves" | "sand" | "cells" | "snow" | "ink";

export interface BrumeEvents {
  session_start: { pattern: string; mode: string };
  session_complete: { pattern: string; seconds: number; cycles: number };
  session_abandon: { pattern: string; seconds: number; phase: "active" | "paused" };
  checkin_word: { feeling: number; surface: "home" | "decompress" };
  words_card_shown: { surface: Surface; arm: "sentence" };
  words_card_copied: { surface: Surface; arm: "sentence"; room_link: boolean; for_me: boolean; edited: boolean };
  words_card_shared: { surface: Surface; arm: "sentence"; room_link: boolean; for_me: boolean; edited: boolean };
  room_link_toggled: { surface: Surface; on: boolean };
  material_changed: { to: Material | "auto" };
  landing_reached: { seconds: number };
  landing_resumed: Record<string, never>;
  landing_settled: Record<string, never>;
  after_answer: { choice: "lighter" | "same" | "heavy"; material_changes: number };
  room_touch: { strokes: number; seconds: number; material: Material };
  visit: { days_since_first: number };
}

let materialChanges = 0;

export function track<K extends keyof BrumeEvents>(name: K, props: BrumeEvents[K]): void {
  try {
    if (name === "material_changed") materialChanges++;
    if (name === "after_answer") {
      (props as BrumeEvents["after_answer"]).material_changes = materialChanges;
      materialChanges = 0;
    }
    trackEvent(name, props as Record<string, unknown>);
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
 * One `visit` per calendar day, carrying only how many days since the
 * first visit. Two local dates; no id, no cookie, nothing leaves with it
 * but the number.
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
    track("visit", { days_since_first: Math.max(0, today - first) });
  } catch {
    // Storage unavailable — skip silently.
  }
}
