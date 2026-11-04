/**
 * The margin — one optional private line beside a check-in.
 *
 * Privacy contract: entries live ONLY in localStorage on this device.
 * They are never events, never fetched, never spoken, never logged.
 * "Add colour" stays yours — literally.
 */

export interface MarginEntry {
  t: number; // timestamp
  f: number; // feeling index
  m: string; // check-in mode when picked
  note: string; // the word(s) — capped at 140 chars
}

const KEY = "brume.checkin.margin.v1";
const LIMIT = 300; // ~a year of daily notes, bounded

export function getMarginEntries(): MarginEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addMarginEntry(
  feeling: number,
  mode: string,
  note: string,
): MarginEntry | null {
  const trimmed = note.trim().slice(0, 140);
  if (!trimmed) return null;
  const entry: MarginEntry = { t: Date.now(), f: feeling, m: mode, note: trimmed };
  try {
    const list = getMarginEntries();
    list.push(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
    return entry;
  } catch {
    return null;
  }
}
