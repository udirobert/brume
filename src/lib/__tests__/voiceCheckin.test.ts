import { describe, expect, it } from "vitest";
import { matchFeeling } from "../voiceCheckin";

describe("matchFeeling", () => {
  it("matches exact labels", () => {
    expect(matchFeeling("drained")).toBe(8);
    expect(matchFeeling("heavy")).toBe(6);
    expect(matchFeeling("lonely")).toBe(12);
  });
  it("matches phrases and colloquial synonyms", () => {
    expect(matchFeeling("I'm feeling really tired")).toBe(8);
    expect(matchFeeling("stressed out")).toBe(1);
    expect(matchFeeling("calm")).toBe(9);
    expect(matchFeeling("exhausted")).toBe(8);
  });
  it("matches 'a lot' as a long label", () => {
    expect(matchFeeling("a lot")).toBe(2);
  });
  it("matches hopeful", () => {
    expect(matchFeeling("hopeful")).toBe(13);
  });
  it("returns null when nothing matches", () => {
    expect(matchFeeling("quantum banana")).toBeNull();
    expect(matchFeeling("")).toBeNull();
  });
  it("is case and punctuation tolerant", () => {
    expect(matchFeeling("Drained.")).toBe(8);
    expect(matchFeeling("REALLY GOOD!")).toBe(5);
  });
});

describe("matchFeeling — real speech", () => {
  it("maps common emotion words", () => {
    expect(matchFeeling("i feel excited")).toBe(7);
    expect(matchFeeling("happy")).toBe(5);
    expect(matchFeeling("nervous")).toBe(10);
    expect(matchFeeling("frustrated")).toBe(1);
    expect(matchFeeling("relaxed")).toBe(9);
    expect(matchFeeling("sad")).toBe(6);
  });
});

describe("suggestFeeling — never a dead end", () => {
  it("prefix-matches near misses", async () => {
    const { suggestFeeling } = await import("../voiceCheckin");
    expect(suggestFeeling("exhaust")).toBe(8);
    expect(suggestFeeling("wonderful")).toBe(5);
    expect(suggestFeeling("ugh the worst")).toBe(6);
    expect(suggestFeeling("quantum banana")).toBeNull();
  });
});

describe("real-speech regression", () => {
  it("i am feeling great → light, never heavy", () => {
    expect(matchFeeling("i am feeling great")).toBe(5);
    expect(matchFeeling("i am feeling good")).toBe(5);
  });
});
