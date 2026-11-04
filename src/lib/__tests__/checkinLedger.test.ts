// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKIN_REASONS,
  attachReason,
  isCheckInReason,
  readLedger,
  recordCheckIn,
} from "../checkinLedger";

const KEY = "brume.checkin.ledger.v1";

describe("checkinLedger — the room's memory stays on the device", () => {
  beforeEach(() => localStorage.clear());

  it("writes one row per check-in with its daypart", () => {
    recordCheckIn(8, new Date("2026-11-04T07:30:00"));
    recordCheckIn(10, new Date("2026-11-04T23:10:00"));
    const entries = readLedger();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ f: 8, r: null, p: "dawn" });
    expect(entries[1]).toMatchObject({ f: 10, p: "night" });
  });

  it("attaches a reason to the newest unnamed row only", () => {
    recordCheckIn(8, new Date("2026-11-04T07:30:00"));
    recordCheckIn(10, new Date("2026-11-04T09:30:00"));
    const named = attachReason("work");
    expect(named?.t).toBe(readLedger()[1].t);
    expect(readLedger()[1].r).toBe("work");
    expect(readLedger()[0].r).toBeNull();
    // A second name never overwrites one already given; it answers the
    // next-newest row that is still silent.
    expect(attachReason("sleep")).toMatchObject({ f: 8, r: "sleep" });
    expect(readLedger()[1].r).toBe("work");
    expect(attachReason("money")).toBeNull();
  });

  it("refuses a reason outside the closed set", () => {
    recordCheckIn(8);
    expect(attachReason("my boss again tonight" as never)).toBeNull();
    expect(readLedger()[0].r).toBeNull();
  });

  it("never touches the network — storage only", () => {
    const spy = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error("network called");
    };
    recordCheckIn(8, new Date("2026-11-04T07:30:00"));
    attachReason("sleep");
    readLedger();
    globalThis.fetch = spy;
    expect(readLedger()).toHaveLength(1);
  });

  it("drops corrupt rows instead of trusting them", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { f: 8 },
        { t: 1, f: 2, r: "work", p: "day" },
        "junk",
        { t: 2, f: 9, r: "not-a-reason", p: "day" },
      ]),
    );
    expect(readLedger()).toHaveLength(1);
  });

  it("keeps the newest rows when the cap is reached", () => {
    for (let i = 0; i < 730; i++) recordCheckIn(i % 14, new Date(1_700_000_000_000 + i));
    const entries = readLedger();
    expect(entries).toHaveLength(720);
    expect(entries[entries.length - 1].t).toBe(1_700_000_000_000 + 729);
  });

  it("holds the reason set closed and short enough to tap", () => {
    expect(CHECKIN_REASONS.every((r) => isCheckInReason(r.id))).toBe(true);
    expect(CHECKIN_REASONS.length).toBeLessThanOrEqual(8);
  });

  it("survives storage that refuses to be written", () => {
    recordCheckIn(8);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(recordCheckIn(9)).not.toBeNull();
    expect(readLedger()).toHaveLength(1);
    spy.mockRestore();
  });
});
