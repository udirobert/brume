/**
 * PrivacyPolicy — the sensing copy must match the real implementation: no
 * camera at all, and a microphone that is opt-in, one sentence at a time,
 * and records nothing. A published claim that has simply gone stale is worse
 * than no claim, so the wording the app no longer stands behind is pinned
 * out as well as the wording it now uses.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PrivacyPolicy from "../PrivacyPolicy";

const html = renderToString(
  <MemoryRouter>
    <PrivacyPolicy />
  </MemoryRouter>,
);

describe("PrivacyPolicy camera copy", () => {
  it("states the camera is not used", () => {
    expect(html).toContain("does not use your camera");
    expect(html).toContain("never requests camera access");
  });

  it("describes no frame capture or processing", () => {
    expect(html).not.toContain("MediaPipe");
    expect(html).not.toContain("sent to Brume&#x27;s backend for processing");
    expect(html).not.toContain("face landmarks");
    expect(html).not.toContain("camera feedback");
  });

  it("pins the last-updated date", () => {
    expect(html).toContain("Last updated: November 4, 2026");
  });
});

describe("PrivacyPolicy microphone copy", () => {
  it("never claims the microphone is unused", () => {
    expect(html).not.toContain("Camera or microphone input");
    expect(html).not.toContain("never requests microphone");
    expect(html).not.toContain("no microphone");
  });

  it("says what the microphone does, and when", () => {
    expect(html).toContain("The microphone stays off until you tap");
    expect(html).toContain("One tap listens for one sentence");
    expect(html).toContain("AssemblyAI");
  });

  it("states that nothing from the listening is kept", () => {
    expect(html).toContain("The audio is not stored");
    expect(html).toContain("the transcript is not written to your history");
  });

  it("keeps voice proposing, never deciding", () => {
    expect(html).toContain("it never chooses for you");
    expect(html).toContain("works by tapping instead");
  });
});
