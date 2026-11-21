import { describe, expect, it } from "vitest";
import {
  GIFT_LINE_MAX,
  minuteFragment,
  parseMoves,
  readMinute,
  runFirefly,
  type Move,
} from "../roomPlay";

const run = (input: string) => {
  const moves = parseMoves(input);
  expect(moves).not.toBeNull();
  return runFirefly(moves!);
};

describe("parseMoves", () => {
  it("parses single verbs and separators", () => {
    expect(parseMoves("step")).toEqual(["step"]);
    expect(parseMoves("left,right")).toEqual(["left", "right"]);
    expect(parseMoves("step then left then step")).toEqual(["step", "left", "step"]);
    expect(parseMoves("forward, turn left, turn right")).toEqual(["step", "left", "right"]);
  });

  it("expands numeric repeats within 1-8", () => {
    expect(parseMoves("step 3")).toEqual(["step", "step", "step"]);
    expect(parseMoves("turn left 2 step")).toEqual(["left", "left", "step"]);
    expect(parseMoves("step 0")).toBeNull();
    expect(parseMoves("step 9")).toBeNull();
  });

  it("rejects unknown words, stray numbers and trailing garbage", () => {
    expect(parseMoves("step then run")).toBeNull();
    expect(parseMoves("step 2 2")).toBeNull();
    expect(parseMoves("fly")).toBeNull();
    expect(parseMoves("step 2x")).toBeNull();
    expect(parseMoves("")).toBeNull();
    expect(parseMoves("then step")).toBeNull();
    expect(parseMoves("step then")).toBeNull();
    expect(parseMoves("turn")).toBeNull();
    expect(parseMoves("turn around")).toBeNull();
  });

  it("caps a run at 16 moves", () => {
    expect(parseMoves("step 8 step 8")).toHaveLength(16);
    expect(parseMoves("step 8 step 8 step")).toBeNull();
    expect(parseMoves("step ".repeat(17).trim())).toBeNull();
  });
});

describe("runFirefly", () => {
  it("reaches the lantern around the stone", () => {
    const result = run("left step right step 4 right step");
    expect(result.end).toBe("light");
    const last = result.frames[result.frames.length - 1];
    expect(last).toEqual({ x: 4, y: 1, dir: 1 });
  });

  it("stops on the stone", () => {
    const result = run("step 4");
    expect(result.end).toBe("stone");
    const last = result.frames[result.frames.length - 1];
    expect(last).toEqual({ x: 1, y: 1, dir: 0 });
  });

  it("stops at the board edge", () => {
    const result = run("left step step");
    expect(result.end).toBe("edge");
    expect(result.frames[result.frames.length - 1]).toEqual({ x: 0, y: 0, dir: 3 });
  });

  it("records turns as frames and reports short when moves run out", () => {
    const result = run("right right");
    expect(result.end).toBe("short");
    expect(result.frames).toEqual([
      { x: 0, y: 1, dir: 0 },
      { x: 0, y: 1, dir: 1 },
      { x: 0, y: 1, dir: 2 },
    ]);
  });

  it("stops exactly on the lantern without walking past", () => {
    const moves: Move[] = ["step", "step"]; // only reaches the stone…
    const res = runFirefly(moves);
    expect(res.end).toBe("stone");
    const win = runFirefly([
      "left", "step", "right", "step", "step", "step", "step", "right", "step",
    ]);
    expect(win.end).toBe("light");
  });
});

describe("minute fragments", () => {
  it("round-trips unicode including &, # and emoji", () => {
    const line = "Salt & light 🌫️ — see you at pier #9";
    const fragment = minuteFragment({ scene: "ferry", line });
    expect(fragment.startsWith("#v=1&scene=ferry&line=")).toBe(true);
    expect(readMinute(fragment)).toEqual({ scene: "ferry", line });
  });

  it("round-trips every scene", () => {
    for (const scene of ["ferry", "window", "garden"] as const) {
      expect(readMinute(minuteFragment({ scene, line: "stay." }))).toEqual({ scene, line: "stay." });
    }
  });

  it("rejects blank, missing and overlong lines", () => {
    expect(readMinute("#v=1&scene=ferry&line=")).toBeNull();
    expect(readMinute("#v=1&scene=ferry&line=%20%20")).toBeNull();
    expect(readMinute("#v=1&scene=ferry")).toBeNull();
    expect(
      readMinute(minuteFragment({ scene: "garden", line: "x".repeat(GIFT_LINE_MAX + 1) })),
    ).toBeNull();
    expect(readMinute(minuteFragment({ scene: "garden", line: "x".repeat(GIFT_LINE_MAX) }))).not.toBeNull();
  });

  it("rejects unknown versions, scenes, duplicate or foreign keys", () => {
    expect(readMinute("#v=2&scene=ferry&line=hi")).toBeNull();
    expect(readMinute("#v=1&scene=cellar&line=hi")).toBeNull();
    expect(readMinute("#v=1&scene=ferry&line=hi&line=bye")).toBeNull();
    expect(readMinute("#v=1&scene=ferry&line=hi&extra=1")).toBeNull();
    expect(readMinute("#scene=ferry&line=hi")).toBeNull();
  });

  it("rejects malformed and overlong input", () => {
    expect(readMinute("#%E0%A4%A")).toBeNull();
    expect(readMinute("not a fragment")).toBeNull();
    expect(readMinute("#")).toBeNull();
    expect(readMinute(`#${"a".repeat(5000)}`)).toBeNull();
  });
});
