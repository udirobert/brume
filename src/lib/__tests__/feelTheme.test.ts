import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { CHECK_IN_SHORT_LABELS } from "../checkin";
import { applyFeel, CHECK_IN_FEELS, clearFeel, feelAt } from "../feelTheme";

describe("feelTheme", () => {
  it("covers every check-in word, lightest to heaviest", () => {
    expect(CHECK_IN_FEELS).toHaveLength(CHECK_IN_SHORT_LABELS.length);
    const weights = CHECK_IN_FEELS.map((f) => f.weight);
    expect([...weights].sort((a, b) => a - b)).toEqual(weights);
    for (const feel of CHECK_IN_FEELS) {
      expect(feel.orbMist).toMatch(/^rgb\(/);
      expect(feel.roomMist).toHaveLength(3);
      expect(feel.weight).toBeGreaterThanOrEqual(0);
      expect(feel.weight).toBeLessThanOrEqual(1);
    }
  });

  it("feelAt guards the range", () => {
    expect(feelAt(null)).toBeNull();
    expect(feelAt(undefined)).toBeNull();
    expect(feelAt(-1)).toBeNull();
    expect(feelAt(CHECK_IN_FEELS.length)).toBeNull();
    expect(feelAt(0)).toBe(CHECK_IN_FEELS[0]);
    expect(feelAt(4)).toBe(CHECK_IN_FEELS[4]);
  });
});

describe("applyFeel / clearFeel", () => {
  const dom = new JSDOM("<!doctype html><html></html>");
  const document = dom.window.document;
  const el = document.documentElement;
  const saved = Object.getOwnPropertyDescriptor(globalThis, "document");

  afterEach(() => {
    if (saved) Object.defineProperty(globalThis, "document", saved);
    else delete (globalThis as { document?: unknown }).document;
  });

  it("tints the room and the orb, then releases both", () => {
    (globalThis as { document?: unknown }).document = document;

    applyFeel(4);
    expect(el.dataset.feel).toBe("4");
    expect(el.style.getPropertyValue("--brume-orb-mist")).toBe(
      CHECK_IN_FEELS[4].orbMist,
    );
    expect(el.style.getPropertyValue("--brume-mist-r")).toBe(
      String(CHECK_IN_FEELS[4].roomMist[0]),
    );
    expect(el.style.getPropertyValue("--brume-feel-weight")).toBe(
      String(CHECK_IN_FEELS[4].weight),
    );

    clearFeel();
    expect(el.dataset.feel).toBeUndefined();
    expect(el.style.getPropertyValue("--brume-orb-mist")).toBe("");
    expect(el.style.getPropertyValue("--brume-mist-b")).toBe("");
    expect(el.style.getPropertyValue("--brume-feel-weight")).toBe("");
  });

  it("applyFeel(null) releases the room", () => {
    (globalThis as { document?: unknown }).document = document;
    applyFeel(2);
    applyFeel(null);
    expect(el.dataset.feel).toBeUndefined();
    expect(el.style.getPropertyValue("--brume-mist-r")).toBe("");
  });
});
