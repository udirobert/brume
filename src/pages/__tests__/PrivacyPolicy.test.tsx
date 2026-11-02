/**
 * PrivacyPolicy — camera copy must match the real implementation:
 * the web app does not use the camera at all.
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
    expect(html).toContain("Last updated: October 16, 2026");
  });
});
