/**
 * The room remembers — E6's treatment, composed from the ledger.
 *
 * One line under the question, built only from closed vocabulary (a
 * feeling's phrase, a daypart, a count): "Restless, three mornings this
 * week." The companion names what it saw and the user draws the
 * conclusion — no chart, no score, no running count, no insight-voice. Nothing
 * here reads or writes anything but the closed-set ledger.
 *
 * The line appears only once the ledger holds enough to name a pattern
 * (MEMORY_MIN_ENTRIES), and only when one feeling-at-one-time-of-day has
 * happened at least twice this week. Fewer than that and there is nothing
 * to say — silence is better than a tally.
 */
import type { DayPart } from "./atmosphere/dayPart";
import type { E6Arm } from "./arms";
import type { LedgerEntry } from "./checkinLedger";
import { feelingAt } from "./feelings";
import { rememberedMaterialFromFeelings, type RoomMaterial } from "./roomExperience";

export const MEMORY_MIN_ENTRIES = 7;
const WEEK_MS = 7 * 86_400_000;

const PART_WORD: Record<DayPart, string> = {
  dawn: "mornings",
  day: "middays",
  dusk: "evenings",
  night: "nights",
};

const COUNT_WORD = ["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Every closed string the line can be built from, for the copy guard. */
export const MEMORY_PART_WORDS: readonly string[] = Object.values(PART_WORD);

const countWord = (n: number) => COUNT_WORD[n] ?? "many";

/**
 * The pattern of the last seven days: the (feeling, daypart) pair that
 * recurred most, ties going to the most recent. Null when nothing recurred.
 */
export function memoryLine(entries: readonly LedgerEntry[], now: number = Date.now()): string | null {
  if (entries.length < MEMORY_MIN_ENTRIES) return null;

  const cells = new Map<string, { f: number; p: DayPart; n: number; last: number }>();
  for (const e of entries) {
    if (e.t < now - WEEK_MS || e.t > now + 86_400_000) continue;
    if (!feelingAt(e.f) || !(e.p in PART_WORD)) continue;
    const key = `${e.f}:${e.p}`;
    const cell = cells.get(key);
    if (cell) {
      cell.n += 1;
      cell.last = Math.max(cell.last, e.t);
    } else {
      cells.set(key, { f: e.f, p: e.p, n: 1, last: e.t });
    }
  }

  let best: { f: number; p: DayPart; n: number; last: number } | null = null;
  for (const cell of cells.values()) {
    if (cell.n < 2) continue;
    if (!best || cell.n > best.n || (cell.n === best.n && cell.last > best.last)) best = cell;
  }
  if (!best) return null;

  const phrase = feelingAt(best.f)!.phrase;
  const head = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  return `${head}, ${countWord(best.n)} ${PART_WORD[best.p]} this week.`;
}

export interface MemoryTreatment {
  line: string | null;
  /** The remembered weather as a room skin, or null. */
  material: RoomMaterial | null;
}

/** What this device's arm is shown on Home. Control is shown nothing. */
export function memoryTreatment(
  entries: readonly LedgerEntry[],
  arm: E6Arm,
  now: number = Date.now(),
): MemoryTreatment {
  if (arm === "control" || entries.length < MEMORY_MIN_ENTRIES) {
    return { line: null, material: null };
  }
  return {
    line: memoryLine(entries, now),
    material: arm === "line_room" ? rememberedMaterialFromFeelings(entries.map((e) => e.f)) : null,
  };
}
