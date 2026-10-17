/**
 * SessionPreview — truthful camera disclosure and the permission-free
 * hands-free simulation entry point.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { SessionPreview } from "../SessionPreview";

const pattern = {
  name: "Box Breathing",
  phases: { inhale: 4, hold: 4, exhale: 4 },
};

const render = (ui: React.ReactElement) =>
  renderToString(<MemoryRouter>{ui}</MemoryRouter>);

describe("SessionPreview disclosure", () => {
  it("discloses backend frame processing before the Enable camera button", () => {
    const html = render(
      <SessionPreview
        patternName="Box Breathing"
        pattern={pattern}
        enableCamera
        onStart={() => {}}
      />,
    );
    // React SSR escapes the apostrophe to &#x27;
    const disclosure = "Optional camera feedback sends image frames to Brume&#x27;s backend for";
    expect(html).toContain(disclosure);
    expect(html).toContain("You can practise without it.");
    const disclosureIdx = html.indexOf(disclosure);
    const enableIdx = html.indexOf("Enable camera");
    expect(disclosureIdx).toBeGreaterThan(-1);
    expect(enableIdx).toBeGreaterThan(-1);
    expect(disclosureIdx).toBeLessThan(enableIdx);
    expect(html).not.toContain("see your breath");
    expect(html).not.toContain("Video never leaves");
  });

  it("offers the collapsed hands-free simulation without camera permission", () => {
    const html = render(
      <SessionPreview
        patternName="Box Breathing"
        pattern={pattern}
        enableCamera
        onStart={() => {}}
      />,
    );
    expect(html).toContain("Try hands-free preview");
    expect(html).not.toContain("Simulation — no camera used");
  });

  it("still offers the preview and no camera claims when camera is disabled", () => {
    const html = render(
      <SessionPreview
        patternName="Box Breathing"
        pattern={pattern}
        enableCamera={false}
        onStart={() => {}}
      />,
    );
    expect(html).toContain("Try hands-free preview");
    expect(html).not.toContain("Enable camera");
    expect(html).not.toContain("sends image frames");
  });
});
