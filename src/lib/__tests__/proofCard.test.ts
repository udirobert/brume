/**
 * proofCard — the share card must not claim scores or verification.
 * The canvas context is mocked to capture every string drawn.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderProofCard } from "../proofCard";

const drawnTexts: string[] = [];

function fakeGradient() {
  return { addColorStop: () => {} };
}

const fakeCtx = {
  fillStyle: "" as unknown,
  strokeStyle: "" as unknown,
  font: "",
  textAlign: "",
  letterSpacing: "",
  lineWidth: 0,
  lineCap: "",
  lineJoin: "",
  createLinearGradient: fakeGradient,
  createRadialGradient: fakeGradient,
  fillRect: () => {},
  beginPath: () => {},
  arc: () => {},
  stroke: () => {},
  fill: () => {},
  moveTo: () => {},
  lineTo: () => {},
  fillText: (text: string) => {
    drawnTexts.push(text);
  },
};

const realDocument = globalThis.document;

beforeAll(() => {
  // Minimal DOM stub — enough for renderProofCard to run under node.
  (globalThis as Record<string, unknown>).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => fakeCtx,
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["x"], { type: "image/png" })),
    }),
  };
});

afterAll(() => {
  (globalThis as Record<string, unknown>).document = realDocument;
});

describe("renderProofCard", () => {
  it("renders real duration and pattern, no score or verification", async () => {
    drawnTexts.length = 0;
    const blob = await renderProofCard({
      patternName: "Box Breathing",
      duration: 90,
      cycles: 6,
    });
    expect(blob).not.toBeNull();
    expect(drawnTexts).toContain("1m 30s");
    expect(drawnTexts).toContain("practice time");
    expect(drawnTexts).toContain("SESSION COMPLETE");
    expect(drawnTexts).toContain("Box Breathing");
    expect(drawnTexts).toContain("6");

    const all = drawnTexts.join(" ");
    expect(all).not.toContain("Score");
    expect(all).not.toContain("stillness");
    expect(all).not.toContain("SEEN");
    expect(all).not.toContain("VERIFIED");
  });

  it("omits cycles when unknown", async () => {
    drawnTexts.length = 0;
    await renderProofCard({ patternName: "Box Breathing", duration: 45 });
    expect(drawnTexts).not.toContain("CYCLES");
    expect(drawnTexts).not.toContain("0");
  });
});
