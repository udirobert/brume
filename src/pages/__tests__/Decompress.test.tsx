import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Decompress from "../Decompress";
import {
  DECOMPRESS_SECONDS,
  composeDecompressMessage,
  getDecompressStep,
} from "@/lib/decompress";

describe("Decompress helpers", () => {
  it("walks the guided pause across the full two minutes", () => {
    expect(getDecompressStep(0).title).toBe("Arrive");
    expect(getDecompressStep(19.9).title).toBe("Arrive");
    expect(getDecompressStep(20).title).toBe("Settle");
    expect(getDecompressStep(79).title).toBe("Soften");
    expect(getDecompressStep(DECOMPRESS_SECONDS).title).toBe("Land");
  });

  it("writes a low-pressure message without asking for an explanation", () => {
    expect(composeDecompressMessage(2, null)).toBe(
      "I'm carrying a lot today. I don't need it solved; I just wanted you to know.",
    );
    expect(composeDecompressMessage(4, "listening")).toBe(
      "I'm quietly overwhelmed today. Listening would help; I don't need it solved.",
    );
  });
});

describe("Decompress page", () => {
  it("opens with one begin, the two quiet links, and nothing else", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/decompress"]}>
        <Decompress />
      </MemoryRouter>,
    );

    expect(html).toContain("A little room for you.");
    expect(html).toContain("Begin a two-minute pause");
    expect(html).toContain('href="/decompress?room=firefly"');
    expect(html).toContain('href="/decompress?room=minute"');
    expect(html).toContain("Play with a firefly");
    expect(html).toContain("Make a gift");

    // No rail, no immediate check-in, no presence/rhythm/share controls.
    expect(html).not.toContain("dc-rail");
    expect(html).not.toContain("How are you feeling?");
    expect(html).not.toContain("Brume presence");
    expect(html).not.toContain("Sound off");
    expect(html).not.toContain("Rhythm sound");
    expect(html).not.toContain("Put it into words");
    expect(html).not.toContain("dc-share-card");
    expect(html).not.toContain("Take a moment");
    expect(html).not.toContain("Just check in");
    expect(html).not.toContain("score");
    expect(html).not.toContain("streak");
  });
});
