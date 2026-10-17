/**
 * PrivacyPolicy — camera copy must match the real implementation:
 * frames go to the backend; nothing is claimed to stay on-device.
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
  it("discloses backend frame processing", () => {
    expect(html).toContain("sent to Brume&#x27;s backend for processing");
    expect(html).toContain("MediaPipe");
    expect(html).toContain("not a clinical measurement");
  });

  it("makes no local-only or identification claims", () => {
    expect(html).not.toContain("entirely on your device");
    expect(html).not.toContain("Never transmitted to our servers");
    expect(html).not.toContain("personally identifiable visual information");
    expect(html).not.toContain("happens locally on your device");
  });

  it("pins the last-updated date", () => {
    expect(html).toContain("Last updated: October 16, 2026");
  });
});
