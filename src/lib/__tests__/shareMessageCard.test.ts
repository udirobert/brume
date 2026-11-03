/**
 * shareMessageCard — pure helpers (wrap, tint, filename) plus the
 * graceful null return when canvas is unavailable (jsdom, SSR).
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import {
  messageCardFilename,
  mistRgba,
  renderMessageCard,
  shareMessageCard,
  wrapText,
} from "../shareMessageCard";

/** Fake measurer: every character is 10px wide. */
const measure = (s: string) => s.length * 10;

describe("wrapText", () => {
  it("keeps short messages on one line", () => {
    expect(wrapText(measure, "I'm okay as I am today.", 800, 4)).toEqual([
      "I'm okay as I am today.",
    ]);
  });

  it("wraps at word boundaries and never exceeds maxLines", () => {
    const text =
      "I'm carrying a lot today and I wanted you to know before the week runs away with me again";
    const lines = wrapText(measure, text, 300, 4);
    expect(lines.length).toBeGreaterThan(1); // actually wrapped
    expect(lines.length).toBeLessThanOrEqual(4);
    for (const line of lines) {
      expect(measure(line.replace(/…$/, ""))).toBeLessThanOrEqual(300);
    }
  });

  it("truncates overflow with an ellipsis on the last line", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve";
    const lines = wrapText(measure, text, 200, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("returns nothing for empty input", () => {
    expect(wrapText(measure, "   ", 200, 4)).toEqual([]);
    expect(wrapText(measure, "hello", 200, 0)).toEqual([]);
  });
});

describe("mistRgba", () => {
  it("parses space-separated rgb() from --brume-orb-mist", () => {
    expect(mistRgba("rgb(146 158 214)", 0.5)).toBe("rgba(146, 158, 214, 0.5)");
  });

  it("parses comma-separated rgb() and hex", () => {
    expect(mistRgba("rgb(146,158,214)", 1)).toBe("rgba(146, 158, 214, 1)");
    expect(mistRgba("#929ed6", 0.25)).toBe("rgba(146, 158, 214, 0.25)");
  });

  it("falls back to the pear mist for unknown input", () => {
    expect(mistRgba(undefined, 0.4)).toBe("rgba(198, 214, 60, 0.4)");
    expect(mistRgba("not-a-colour", 0.4)).toBe("rgba(198, 214, 60, 0.4)");
  });
});

describe("messageCardFilename", () => {
  it("slugs the pattern name", () => {
    expect(messageCardFilename("Box Breathing")).toBe(
      "brume-words-box-breathing.png",
    );
    expect(messageCardFilename("4-7-8 Reset!")).toBe("brume-words-4-7-8-reset.png");
  });

  it("has a stable default without a pattern", () => {
    expect(messageCardFilename()).toBe("brume-words.png");
    expect(messageCardFilename("")).toBe("brume-words.png");
  });
});

describe("renderMessageCard", () => {
  it("returns null when the canvas context is unavailable", async () => {
    // jsdom has no 2d context — the guard must turn that into null, not throw.
    await expect(renderMessageCard("hello", "rgb(1 2 3)")).resolves.toBeNull();
  });
});

describe("shareMessageCard", () => {
  it("copies the message when no image path exists", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await expect(
      shareMessageCard({ message: "I'm okay as I am today." }),
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("I'm okay as I am today.");
  });

  it("reports unavailable when even the clipboard is missing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    await expect(
      shareMessageCard({ message: "hello" }),
    ).resolves.toBe("unavailable");
  });
});
