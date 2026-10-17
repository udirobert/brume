/**
 * PostSessionCelebration — no scores, no verification marks.
 * Hero is the recorded duration; zero stays zero.
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("framer-motion", () => {
  const passthrough = ({ children, ...rest }: Record<string, unknown>) => {
    const { initial: _i, animate: _a, transition: _t, ...dom } = rest as Record<string, unknown>;
    return <div {...dom}>{children as React.ReactNode}</div>;
  };
  return {
    motion: new Proxy({}, { get: () => passthrough }),
    useReducedMotion: () => true,
  };
});
vi.mock("@/lib/notifications/oneSignal", () => ({
  trackCredentialShared: vi.fn(),
}));

import { PostSessionCelebration } from "../PostSessionCelebration";

describe("PostSessionCelebration", () => {
  it("shows the real duration as the hero and labels it practice time", () => {
    const html = renderToString(
      <PostSessionCelebration metrics={{ patternName: "Box Breathing", duration: 300 }} />,
    );
    expect(html).toContain("5m");
    expect(html).toContain("practice time");
    expect(html).not.toContain("stillness");
    expect(html).not.toContain("Seen");
    expect(html).not.toContain("credential");
    expect(html).not.toContain("Mint");
  });

  it("never fabricates a minimum duration for zero", () => {
    const html = renderToString(
      <PostSessionCelebration metrics={{ patternName: "Box Breathing", duration: 0 }} />,
    );
    expect(html).toContain("0s");
    expect(html).not.toContain("1s");
  });

  it("renders no score", () => {
    const html = renderToString(
      <PostSessionCelebration
        metrics={{ patternName: "Box Breathing", duration: 60 }}
      />,
    );
    expect(html).not.toContain(">75<");
    expect(html).not.toContain("score");
  });

  it("shows cycle count only when supplied", () => {
    const withCycles = renderToString(
      <PostSessionCelebration
        metrics={{ patternName: "Box Breathing", duration: 60, cycles: 8 }}
      />,
    );
    expect(withCycles).toContain("8 cycles");
    const without = renderToString(
      <PostSessionCelebration metrics={{ patternName: "Box Breathing", duration: 60 }} />,
    );
    expect(without).not.toContain("cycles");
  });

  it("shows streak only when it is a positive supplied number", () => {
    const streaked = renderToString(
      <PostSessionCelebration
        metrics={{ patternName: "Box Breathing", duration: 60, streak: 3 }}
      />,
    );
    expect(streaked).toContain("Day 3");

    const zero = renderToString(
      <PostSessionCelebration
        metrics={{ patternName: "Box Breathing", duration: 60, streak: 0 }}
      />,
    );
    expect(zero).not.toContain("Day 1");
    expect(zero).not.toContain("Day 0");

    const unknown = renderToString(
      <PostSessionCelebration metrics={{ patternName: "Box Breathing", duration: 60 }} />,
    );
    expect(unknown).not.toContain("Day 1");
  });

  it("uses the factual insight passed in", () => {
    const html = renderToString(
      <PostSessionCelebration
        metrics={{ patternName: "Box Breathing", duration: 60 }}
        insight="You practised Box Breathing."
      />,
    );
    expect(html).toContain("You practised Box Breathing.");
  });
});
