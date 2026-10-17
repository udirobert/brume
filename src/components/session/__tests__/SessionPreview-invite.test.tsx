/**
 * SessionPreview — the recipient side of "pass this break on".
 * `?via=invite` adds a cosmetic "someone passed you a break" line and
 * nothing else: no tracking, no personal data.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { SessionPreview } from "../SessionPreview";

const pattern = {
  name: "Reset",
  phases: { inhale: 4, hold: 0, exhale: 6 },
};

const render = (entry: string) =>
  renderToString(
    <MemoryRouter initialEntries={[entry]}>
      <SessionPreview
        patternName="Reset"
        pattern={pattern}
        enableCamera
        onStart={() => {}}
      />
    </MemoryRouter>
  );

describe("SessionPreview invitation landing", () => {
  it("shows the invitation line when ?via=invite", () => {
    const html = render("/session?pattern=reset&via=invite");
    expect(html).toContain("Someone passed you a break");
    // Recipient still has exactly one obvious action, camera-free.
    expect(html).toContain("Breathe without camera");
    expect(html).toContain("Reset");
  });

  it("stays quiet without the flag", () => {
    const html = render("/session?pattern=reset");
    expect(html).not.toContain("Someone passed you a break");
    expect(html).toContain("Breathe without camera");
  });

  it("ignores other via values", () => {
    const html = render("/session?pattern=reset&via=social");
    expect(html).not.toContain("Someone passed you a break");
  });
});
