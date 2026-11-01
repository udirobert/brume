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
  it("opens as a private pause with check-in as a first-class choice", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/decompress"]}>
        <Decompress />
      </MemoryRouter>,
    );

    expect(html).toContain("A little room");
    expect(html).toContain("Take a moment");
    expect(html).toContain("Just check in");
    expect(html).toContain("No account. Nothing saved.");
    expect(html).toContain("Brume presence");
    expect(html).toContain("Company");
    expect(html).toContain('data-presence="companion"');
    expect(html).not.toContain("How are you really");
    expect(html).not.toContain("score");
    expect(html).not.toContain("streak");
  });
});
