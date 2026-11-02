/**
 * SessionPreview — one obvious action: Begin. No camera anywhere.
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

describe("SessionPreview", () => {
  it("renders a Begin button and no camera text", () => {
    const html = render(
      <SessionPreview
        patternName="Box Breathing"
        pattern={pattern}
        onStart={() => {}}
      />,
    );
    expect(html).toContain("Begin");
    expect(html.toLowerCase()).not.toContain("camera");
    expect(html).not.toContain("sends image frames");
    expect(html).not.toContain("see your breath");
  });

  it("surfaces the spoken-cues choice before first play", () => {
    const html = render(
      <SessionPreview
        patternName="Box Breathing"
        pattern={pattern}
        onStart={() => {}}
        audioEnabled={true}
        onToggleAudio={() => {}}
      />,
    );
    expect(html).toContain("Spoken breath cues");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Hear a spoken cue");
    expect(html).toContain("nothing is sent anywhere");
  });

  it("hides the spoken-cues row when the parent does not pass the choice", () => {
    const html = render(
      <SessionPreview
        patternName="Box Breathing"
        pattern={pattern}
        onStart={() => {}}
      />,
    );
    expect(html).not.toContain("Spoken breath cues");
  });
});
