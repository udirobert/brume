import { beforeEach, describe, expect, it } from "vitest";
import {
  FLIGHT_MIN_DIST,
  FLIGHT_MIN_STRENGTH,
  FLIGHT_STALE_MS,
  flightVector,
  readCenter,
  recordCompanion,
  resetCompanionTrail,
  stampDeparture,
} from "../mascotFlight";

const spot = (cx: number, cy: number) => ({ cx, cy });

beforeEach(() => resetCompanionTrail());

describe("readCenter", () => {
  it("returns the rect centre when there is no transform", () => {
    expect(
      readCenter({ left: 100, top: 200, width: 104, height: 104 }, "none"),
    ).toEqual({ cx: 152, cy: 252 });
  });

  it("subtracts the element's own translation (mid-flight reads land on the destination)", () => {
    const rect = { left: 140, top: 160, width: 104, height: 104 };
    expect(readCenter(rect, "matrix(1, 0, 0, 1, 40, 60)")).toEqual({ cx: 152, cy: 152 });
  });

  it("returns null for a detached/zero-size host", () => {
    expect(readCenter({ left: 0, top: 0, width: 0, height: 0 }, "none")).toBeNull();
  });
});

describe("flightVector", () => {
  it("reports nothing with an empty trail", () => {
    expect(flightVector(1, spot(640, 112), 1000)).toBeNull();
  });

  it("ignores a mount's own records — StrictMode replays can't hide the previous screen", () => {
    recordCompanion(1, "idle", spot(640, 156), 100);
    recordCompanion(2, "watching", spot(640, 112), 200);
    const flight = flightVector(2, spot(640, 112), 210);
    expect(flight).not.toBeNull();
    expect(flight!.fromState).toBe("idle");
    expect(flight!.smear.y).toBeCloseTo(-1, 5); // travelled straight up
  });

  it("returns null when the travel is shorter than the pop threshold", () => {
    recordCompanion(1, "idle", spot(640, 156), 100);
    expect(flightVector(2, spot(640, 156 + FLIGHT_MIN_DIST - 5), 200)).toBeNull();
  });

  it("returns null when the previous spot is stale", () => {
    recordCompanion(1, "idle", spot(640, 156), 100);
    expect(flightVector(2, spot(640, 400), 100 + FLIGHT_STALE_MS + 1)).toBeNull();
  });

  it("evicts the oldest entries past four so the trail stays small", () => {
    for (let i = 0; i < 6; i += 1) {
      recordCompanion(i + 1, "idle", spot(0, 0), i);
    }
    // Oldest survivors are id 3..6 — a new mount sees id 6, not id 1.
    const flight = flightVector(9, spot(400, 400), 10);
    expect(flight).not.toBeNull();
  });

  it("gives every real flight a strength floor — short hops still dart", () => {
    recordCompanion(1, "idle", spot(640, 156), 100);
    const hop = flightVector(2, spot(640, 112), 200); // dist 44
    expect(hop!.smear.strength).toBeGreaterThan(FLIGHT_MIN_STRENGTH);
    expect(hop!.smear.strength).toBeLessThan(0.5);
  });

  it("reaches full strength on a long flight", () => {
    recordCompanion(1, "idle", spot(100, 100), 100);
    const flight = flightVector(2, spot(600, 400), 200); // dist 500
    expect(flight!.smear.strength).toBe(1);
    expect(Math.hypot(flight!.smear.x, flight!.smear.y)).toBeCloseTo(1, 5);
  });

  it("clamps gaze and lean for long flights", () => {
    recordCompanion(1, "idle", spot(0, 0), 100);
    const flight = flightVector(2, spot(2000, 1000), 200);
    expect(flight!.gaze.x).toBe(2.4);
    expect(flight!.gaze.y).toBe(1.8);
    expect(flight!.lean).toBe(4);
  });
});

describe("stampDeparture", () => {
  it("refreshes the time of the instance's own latest entry, not its position", () => {
    recordCompanion(1, "idle", spot(640, 156), 100);
    recordCompanion(2, "idle", spot(10, 10), 150);
    stampDeparture(1, 5000);
    // id 1's entry keeps its position but is now fresh → id 3 sees it.
    const flight = flightVector(3, spot(640, 400), 5001);
    expect(flight).not.toBeNull();
    expect(flight!.fromState).toBe("idle");
  });

  it("does nothing when the instance never recorded", () => {
    recordCompanion(1, "idle", spot(640, 156), 100);
    stampDeparture(9, 5000);
    expect(flightVector(3, spot(640, 400), 5001)).toBeNull();
  });
});
