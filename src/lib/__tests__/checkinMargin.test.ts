// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { addMarginEntry, getMarginEntries } from "../checkinMargin";

describe("checkinMargin — device-local only", () => {
  beforeEach(() => localStorage.clear());

  it("stores entries locally and returns them", () => {
    addMarginEntry(8, "avoid", "work deadline");
    addMarginEntry(9, "now", "after the walk");
    const entries = getMarginEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ f: 8, m: "avoid", note: "work deadline" });
  });

  it("trims and caps at 140 chars, skips empty", () => {
    expect(addMarginEntry(8, "now", "   ")).toBeNull();
    addMarginEntry(8, "now", "x".repeat(200));
    expect(getMarginEntries()[0].note).toHaveLength(140);
  });

  it("never touches the network — storage only", () => {
    const spy = globalThis.fetch;
    globalThis.fetch = () => { throw new Error("network called"); };
    addMarginEntry(8, "now", "quiet");
    globalThis.fetch = spy;
    expect(getMarginEntries()).toHaveLength(1);
  });
});
