/**
 * The check-in ledger — the one place Brume keeps a memory of you.
 *
 * Append-only, device-local, and the spine the recap, the memory line and
 * any future host handoff read from. Every field is a number, a null or a
 * member of a closed set, so there is no field a user's words could be
 * put into: a reason is chosen from this list or not recorded at all.
 * Nothing here is ever fetched, logged, spoken or sent — the privacy
 * promise is a property of the schema, not of the copy.
 *
 * Session minutes are deliberately absent: they join by local day from
 * the session store rather than being stored twice and drifting.
 */

import { dayPartFromHour, type DayPart } from "./atmosphere/dayPart";

export const CHECKIN_REASONS = [
  { id: "work", label: "work" },
  { id: "people", label: "people" },
  { id: "sleep", label: "sleep" },
  { id: "money", label: "money" },
  { id: "day", label: "the day" },
  { id: "good", label: "something good" },
] as const;

export type CheckInReasonId = (typeof CHECKIN_REASONS)[number]["id"];

export const isCheckInReason = (v: unknown): v is CheckInReasonId =>
  typeof v === "string" && CHECKIN_REASONS.some((r) => r.id === v);

export interface LedgerEntry {
  t: number; // ms since epoch
  f: number; // feeling index into FEELINGS
  r: CheckInReasonId | null; // named later, or never — silence is data
  p: DayPart;
}

const KEY = "brume.checkin.ledger.v1";
const LIMIT = 720; // ~two check-ins a day for a year, bounded

function write(entries: LedgerEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage refused — the memory stays in the room and nothing breaks.
  }
}

export function readLedger(): LedgerEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: LedgerEntry) => {
      return (
        e &&
        typeof e.t === "number" &&
        Number.isInteger(e.f) &&
        e.f >= 0 &&
        (e.r === null || isCheckInReason(e.r)) &&
        typeof e.p === "string"
      );
    });
  } catch {
    return [];
  }
}

/** One row per check-in. Returns the entry, or null if it was refused. */
export function recordCheckIn(
  feeling: number,
  now: Date = new Date(),
): LedgerEntry | null {
  if (!Number.isInteger(feeling) || feeling < 0) return null;
  const entry: LedgerEntry = {
    t: now.getTime(),
    f: feeling,
    r: null,
    p: dayPartFromHour(now.getHours()),
  };
  write([...readLedger(), entry].slice(-LIMIT));
  return entry;
}

/**
 * Attach a reason to the newest check-in that has none. Naming the reason
 * is optional, so the newest unnamed row is the one being answered.
 */
export function attachReason(reason: CheckInReasonId): LedgerEntry | null {
  if (!isCheckInReason(reason)) return null;
  const entries = readLedger();
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].r === null) {
      entries[i] = { ...entries[i], r: reason };
      write(entries);
      return entries[i];
    }
  }
  return null;
}
