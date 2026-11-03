import { describe, it, expect } from "vitest";
import {
  FEELINGS,
  FEELING_PAIRS,
  feelingAt,
  isPositiveFeel,
  initialPairedFeelState,
  oppositeFeel,
  pairForFeel,
  selectPairedFeel,
} from "../feelings";
import { getPattern } from "../breathingPatterns";

describe("feelings catalog", () => {
  it("has 14 entries with the original five unchanged", () => {
    expect(FEELINGS).toHaveLength(14);
    const labels = FEELINGS.slice(0, 5).map((f) => f.label);
    expect(labels).toEqual(["Okay", "Stretched", "A lot", "At limit", "Overwhelmed"]);
    expect(FEELINGS[0].phrase).toBe("okay as I am");
    expect(FEELINGS[4].phrase).toBe("quietly overwhelmed");
    expect(FEELINGS.slice(0, 5).map((f) => f.patternId)).toEqual([
      "mindfulness",
      "box",
      "relaxation",
      "relaxation",
      "reset",
    ]);
  });

  it("every pattern id resolves", () => {
    for (const f of FEELINGS) expect(getPattern(f.patternId)).toBeTruthy();
  });

  it("feelingAt guards invalid input", () => {
    expect(feelingAt(99)).toBeNull();
    expect(feelingAt(NaN)).toBeNull();
    expect(feelingAt(1.5)).toBeNull();
    expect(feelingAt(-1)).toBeNull();
    expect(feelingAt(null)).toBeNull();
    expect(feelingAt(13)?.id).toBe("hopeful");
  });

  it("valence: hopeful positive, overwhelmed heavy", () => {
    expect(isPositiveFeel(13)).toBe(true);
    expect(isPositiveFeel(4)).toBe(false);
  });

  it("heavy rows never celebrate; positive paired states diversify", () => {
    for (const f of FEELINGS.filter((x) => x.valence === "heavy")) {
      expect(["hop", "celebrate"]).not.toContain(f.reaction);
      expect(["bright", "stretch", "proud", "hum"]).not.toContain(f.state);
    }
    const pairedPositive = FEELING_PAIRS.flatMap((p) =>
      p.indices.map((i) => FEELINGS[i]),
    ).filter((f) => f.valence === "positive");
    expect(pairedPositive.map((f) => f.state).sort()).toEqual(
      ["bright", "hum", "proud", "stretch", "tender"].sort(),
    );
  });
});

describe("paired selection", () => {
  it("initial faces are the approved five", () => {
    expect(initialPairedFeelState(null).faces).toEqual([5, 8, 9, 12, 4]);
  });

  it("select-flip-select-back sequence", () => {
    let s = initialPairedFeelState(null);
    s = selectPairedFeel(s, 0);
    expect(s.selected).toBe(5);
    s = selectPairedFeel(s, 0);
    expect(s.selected).toBe(6);
    expect(s.faces[0]).toBe(6);
    s = selectPairedFeel(s, 1);
    expect(s.selected).toBe(8);
    s = selectPairedFeel(s, 0);
    expect(s.selected).toBe(6);
    s = selectPairedFeel(s, 0);
    expect(s.selected).toBe(5);
    expect(s.faces[1]).toBe(8);
  });

  it("opposite reverses for normal paired ids", () => {
    for (const p of FEELING_PAIRS) {
      for (const i of p.indices) {
        expect(oppositeFeel(oppositeFeel(i))).toBe(i);
      }
    }
  });

  it("legacy index shows as its pair face and flips to the actual opposite", () => {
    const s = initialPairedFeelState(0);
    expect(s.faces[2]).toBe(0);
    expect(s.selected).toBe(0);
    const next = selectPairedFeel(s, 2);
    expect(next.selected).toBe(10);
  });

  it("initial normalizes invalid selection to null", () => {
    expect(initialPairedFeelState(99).selected).toBeNull();
    expect(initialPairedFeelState(99).faces).toEqual([5, 8, 9, 12, 4]);
  });
});
