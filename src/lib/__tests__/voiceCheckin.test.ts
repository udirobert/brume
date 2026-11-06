import { describe, expect, it } from "vitest";
import { hasNegation, matchFeeling, matchPattern, suggestFeeling } from "../voiceCheckin";

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

describe("negation — ask, never declare", () => {
  // The failure this guard exists for: a negated sentence once read as a
  // positive feeling, mascot and all. norm() cannot see negation ("don't"
  // becomes "do t", "not" is dropped by the length gates), so it is
  // checked on the raw transcript and no reading is returned at all.
  it("detects negation the normaliser would erase", () => {
    expect(hasNegation("I don't feel good at all")).toBe(true);
    expect(hasNegation("i'm not feeling great")).toBe(true);
    expect(hasNegation("not good")).toBe(true);
    expect(hasNegation("i feel nothing")).toBe(true);
    expect(hasNegation("i'm overwhelmed")).toBe(false);
  });

  it("returns no match and no suggestion for a negated transcript", () => {
    for (const t of [
      "i'm not feeling great",
      "I don't feel good at all",
      "not good",
      "i feel nothing",
      "i'm not tired",
      "no, I'm fine",
    ]) {
      expect(matchFeeling(t), t).toBeNull();
      expect(suggestFeeling(t), t).toBeNull();
    }
  });

  it("does not mistake a letter inside a word for negation", () => {
    expect(hasNegation("i know i am tired")).toBe(false);
    expect(hasNegation("nothing is wrong but i feel light")).toBe(true);
    expect(matchFeeling("i know i am tired")).toBe(8);
  });
});

describe("matchPattern", () => {
  it("matches rhythm names and aliases", () => {
    expect(matchPattern("box")).toBe("box");
    expect(matchPattern("box breathing")).toBe("box");
    expect(matchPattern("4-7-8")).toBe("relaxation");
    expect(matchPattern("four seven eight")).toBe("relaxation");
    expect(matchPattern("wim hof please")).toBe("wim_hof");
    expect(matchPattern("sleep breath")).toBe("sleep");
  });
  it("refuses negations like every other catalog", () => {
    expect(matchPattern("not box")).toBeNull();
    expect(matchPattern("no sleep breath")).toBeNull();
  });
  it("stays quiet on feeling words and noise", () => {
    expect(matchPattern("i feel tense")).toBeNull();
    expect(matchPattern("quantum banana")).toBeNull();
    expect(matchPattern("")).toBeNull();
  });
});

import { createTurnJoiner, toPcm16, classifyMicError, VOICE_FAILURE_COPY } from "../voiceCheckin";

describe("toPcm16", () => {
  it("keeps 16k samples as-is from a 16k context", () => {
    const f32 = new Float32Array([0.5, -0.5, 0, 1, -1]);
    const { pcm, peak } = toPcm16(f32, 16000);
    expect(pcm.length).toBe(5);
    expect(pcm[0]).toBe(Math.round(0.5 * 32767));
    expect(peak).toBeCloseTo(1, 5);
  });
  it("downsamples 48k to 16k with the ratio it was given", () => {
    const f32 = new Float32Array(4800).fill(0.25);
    const { pcm } = toPcm16(f32, 48000);
    expect(pcm.length).toBe(1600);
    expect(pcm[0]).toBe(Math.round(0.25 * 32767));
  });
});

describe("createTurnJoiner", () => {
  it("joins turns and keeps interim live text", () => {
    const j = createTurnJoiner();
    j.add({ transcript: "I'm tense", end_of_turn: true, turn_is_formatted: true });
    j.add({ transcript: "big call", end_of_turn: false });
    expect(j.text()).toBe("I'm tense big call");
    expect(j.hasText()).toBe(true);
  });
  it("replaces a raw end-of-turn with its formatted twin", () => {
    const j = createTurnJoiner();
    j.add({ transcript: "raw turn", end_of_turn: true, turn_is_formatted: false });
    j.add({ transcript: "Raw turn.", end_of_turn: true, turn_is_formatted: true });
    expect(j.text()).toBe("Raw turn.");
  });
});

describe("classifyMicError", () => {
  it("tells a refusal from a missing microphone", () => {
    expect(classifyMicError({ name: "NotAllowedError" })).toBe("mic_blocked");
    expect(classifyMicError({ name: "SecurityError" })).toBe("mic_blocked");
    expect(classifyMicError({ name: "NotFoundError" })).toBe("no_mic");
    expect(classifyMicError(new Error("x"))).toBe("no_mic");
  });
  it("every failure has a line to show, ending in the tap-way-out", () => {
    for (const k of ["mic_blocked", "no_mic", "offline", "unavailable", "insecure"] as const) {
      expect(VOICE_FAILURE_COPY[k].length).toBeGreaterThan(8);
      expect(VOICE_FAILURE_COPY[k]).toMatch(/tap a word/);
    }
  });
  it("the blocked-mic line says where to fix it", () => {
    expect(VOICE_FAILURE_COPY.mic_blocked).toMatch(/site settings/i);
  });
});
