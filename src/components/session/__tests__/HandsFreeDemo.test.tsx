/**
 * HandsFreeDemo — simulation reducer and disclosure markup.
 * The simulation is fully local: no camera, no permissions, no session store.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  HandsFreeDemo,
  handsFreeDemoReducer,
  handsFreeDemoStatusText,
  initialHandsFreeDemoState,
  type HandsFreeDemoState,
} from "../HandsFreeDemo";

const tracking = (paused = false): HandsFreeDemoState => ({
  paused,
  signal: "tracking",
});

describe("handsFreeDemoReducer", () => {
  it("starts running and tracking", () => {
    expect(initialHandsFreeDemoState).toEqual({ paused: false, signal: "tracking" });
    expect(handsFreeDemoStatusText(initialHandsFreeDemoState)).toBe(
      "Practice running · Tracking",
    );
  });

  it("eyebrow raise toggles pause only while tracking", () => {
    const paused = handsFreeDemoReducer(tracking(false), "toggle-pause");
    expect(paused.paused).toBe(true);
    expect(handsFreeDemoStatusText(paused)).toBe("Practice paused · Tracking");
    const resumed = handsFreeDemoReducer(paused, "toggle-pause");
    expect(resumed.paused).toBe(false);
  });

  it("eyebrow raise does nothing when signal is lost", () => {
    const lost: HandsFreeDemoState = { paused: false, signal: "signal-lost" };
    expect(handsFreeDemoReducer(lost, "toggle-pause")).toEqual(lost);
    const lostPaused: HandsFreeDemoState = { paused: true, signal: "signal-lost" };
    expect(handsFreeDemoReducer(lostPaused, "toggle-pause")).toEqual(lostPaused);
  });

  it("signal loss toggles detection without changing pause state", () => {
    const lost = handsFreeDemoReducer(tracking(true), "toggle-signal");
    expect(lost).toEqual({ paused: true, signal: "signal-lost" });
    expect(handsFreeDemoStatusText(lost)).toBe("Practice paused · Signal lost");
    const restored = handsFreeDemoReducer(lost, "toggle-signal");
    expect(restored).toEqual({ paused: true, signal: "tracking" });
    expect(handsFreeDemoStatusText(restored)).toBe("Practice paused · Tracking");
  });

  it("reset returns to running + tracking", () => {
    const dirty: HandsFreeDemoState = { paused: true, signal: "signal-lost" };
    expect(handsFreeDemoReducer(dirty, "reset")).toEqual(initialHandsFreeDemoState);
  });
});

describe("HandsFreeDemo markup", () => {
  it("disclosure is collapsed by default and labelled as a simulation", () => {
    const html = renderToString(<HandsFreeDemo />);
    expect(html).toContain("Try hands-free preview");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Simulate eyebrow raise");
  });

  it("toggle is wired to the panel via aria-controls", () => {
    const html = renderToString(<HandsFreeDemo defaultOpen />);
    const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
  });

  it("open panel carries a persistent simulation label and live status", () => {
    const html = renderToString(<HandsFreeDemo defaultOpen />);
    expect(html).toContain("Simulation — no camera used");
    expect(html).toContain("Live gesture controls are not available yet.");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Practice running");
    expect(html).toContain("Tracking");
    expect(html).toContain("Reset preview");
  });

  it("gesture button is disabled when the signal is lost", () => {
    const html = renderToString(
      <HandsFreeDemo defaultOpen initialState={{ paused: false, signal: "signal-lost" }} />,
    );
    expect(html).toContain("Signal lost");
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*>\s*Simulate eyebrow raise/,
    );
  });

  it("toggle buttons expose aria-pressed and pause text survives signal loss", () => {
    const html = renderToString(
      <HandsFreeDemo defaultOpen initialState={{ paused: true, signal: "signal-lost" }} />,
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Practice paused");
    expect(html).toContain("Signal lost");
  });
});
