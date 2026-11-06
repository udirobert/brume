import { describe, expect, it } from "vitest";
import { MEMORY_MIN_ENTRIES, memoryLine, memoryTreatment } from "../memoryLine";
import type { LedgerEntry } from "../checkinLedger";
import { FEELINGS } from "../feelings";

const NOW = Date.UTC(2026, 10, 6, 12);
const DAY = 86_400_000;
const RESTLESS = FEELINGS.findIndex((f) => f.id === "restless");
const OKAY = FEELINGS.findIndex((f) => f.id === "okay");

const entry = (daysAgo: number, f: number, p: LedgerEntry["p"] = "dawn"): LedgerEntry => ({
  t: NOW - daysAgo * DAY,
  f,
  r: null,
  p,
});

/** Seven entries so the gate is open; the first three are the pattern. */
const week = (extra: LedgerEntry[] = []): LedgerEntry[] => [
  entry(1, RESTLESS),
  entry(2, RESTLESS),
  entry(3, RESTLESS),
  entry(4, OKAY, "dusk"),
  entry(5, 1, "night"),
  entry(6, 2, "day"),
  entry(6, 3, "night"),
  ...extra,
];

describe("memoryLine", () => {
  it("names a recurring feeling and the part of the day, in words", () => {
    expect(memoryLine(week(), NOW)).toBe("Restless, three mornings this week.");
  });

  it("is silent until the ledger can name a pattern", () => {
    expect(MEMORY_MIN_ENTRIES).toBe(7);
    expect(memoryLine(week().slice(0, 6), NOW)).toBeNull();
    expect(memoryLine([], NOW)).toBeNull();
  });

  it("is silent when nothing recurred — a tally is not a memory", () => {
    const scattered = [0, 1, 2, 3, 4, 5, 6].map((i) => entry(i, i, "day"));
    expect(memoryLine(scattered, NOW)).toBeNull();
  });

  it("only counts the last seven days", () => {
    const old = [10, 11, 12, 13, 14, 15, 16].map((d) => entry(d, RESTLESS));
    expect(memoryLine(old, NOW)).toBeNull();
  });

  it("breaks ties toward the most recent pattern", () => {
    const tied = [
      entry(1, OKAY, "dusk"),
      entry(2, OKAY, "dusk"),
      entry(3, RESTLESS),
      entry(4, RESTLESS),
      entry(5, 1, "night"),
      entry(5, 2, "night"),
      entry(6, 3, "day"),
    ];
    expect(memoryLine(tied, NOW)).toBe("Okay as I am, two evenings this week.");
  });

  it("skips rows it can't name instead of printing a blank", () => {
    const junk = week([{ t: NOW - DAY, f: 99, r: null, p: "dawn" }]);
    expect(memoryLine(junk, NOW)).toBe("Restless, three mornings this week.");
  });

  it("carries no digit, no score word and no outcome", () => {
    const line = memoryLine(week(), NOW)!;
    expect(line).not.toMatch(/\d/);
    expect(line).not.toMatch(/streak|score|better|worse|improv|progress|level|check-ins?/i);
  });
});

describe("memoryTreatment", () => {
  it("shows the control nothing at all", () => {
    expect(memoryTreatment(week(), "control", NOW)).toEqual({ line: null, material: null });
  });

  it("gives the line arm a line and leaves the room alone", () => {
    const t = memoryTreatment(week(), "line", NOW);
    expect(t.line).toBe("Restless, three mornings this week.");
    expect(t.material).toBeNull();
  });

  it("gives the line_room arm the same line plus the weather as a skin", () => {
    const t = memoryTreatment(week(), "line_room", NOW);
    expect(t.line).toBe("Restless, three mornings this week.");
    expect(t.material).toBe("snow");
  });

  it("shows no arm anything before the ledger is ready", () => {
    expect(memoryTreatment(week().slice(0, 3), "line_room", NOW)).toEqual({ line: null, material: null });
  });
});
