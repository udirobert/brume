/**
 * About — the metaphor rendered from data: every catalogued word shows
 * its rhythm, the promises are stated once, nothing claims an outcome.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import About from "../About";

describe("About", () => {
  const html = renderToString(
    <MemoryRouter>
      <About />
    </MemoryRouter>,
  );

  it("maps every feeling to its rhythm from the catalog", () => {
    expect(html).toContain("Every word carries a rhythm");
    // A word from each end of the catalog, with its pattern and phases.
    expect(html).toContain("Overwhelmed");
    expect(html).toContain("Reset · 4 in · 6 out");
    expect(html).toContain("Okay");
    expect(html).toContain("Mindfulness Breath · 5 in · 5 out");
  });

  it("states the promises once and makes no claims", () => {
    expect(html).toContain("No camera. No scores. No streaks.");
    expect(html.toLowerCase()).not.toContain("anxiety");
    expect(html.toLowerCase()).not.toContain("stress relief");
    expect(html.toLowerCase()).not.toContain("sleep quality");
  });
});
