/**
 * PostSessionCelebration — no scores, no verification marks.
 * Duration lives inside Practice details; zero stays zero.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const mascotProps: Record<string, unknown>[] = [];
vi.mock("@/components/BrumeMascot", () => ({
  BrumeMascot: (props: Record<string, unknown>) => {
    mascotProps.push(props);
    return (
      <span
        data-mock-mascot
        data-state={props.state as string}
        data-demeanor={props.demeanor as string}
      />
    );
  },
  default: (props: Record<string, unknown>) => {
    mascotProps.push(props);
    return <span data-mock-mascot />;
  },
}));

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
  it("keeps the real duration inside Practice details labelled practice time", () => {
    const html = renderToString(
      <PostSessionCelebration metrics={{ patternName: "Box Breathing", duration: 300 }} />,
    );
    expect(html).toContain("5m");
    expect(html).toContain("practice time");
    expect(html).toContain("Practice details");
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

  it("renders no score and the gentle landing headline", () => {
    const html = renderToString(
      <PostSessionCelebration
        metrics={{ patternName: "Box Breathing", duration: 60 }}
      />,
    );
    expect(html).toContain("A moment, taken.");
    expect(html).not.toContain(">75<");
    expect(html).not.toContain("score");
  });

  it("shows cycle count with singular/plural only when supplied", () => {
    const one = renderToString(
      <PostSessionCelebration
        metrics={{ patternName: "Box Breathing", duration: 60, cycles: 1 }}
      />,
    );
    expect(one).toContain("1 cycle");
    expect(one).not.toContain("1 cycles");
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

  it("never renders a streak, even when one is supplied", () => {
    const streaked = renderToString(
      <PostSessionCelebration
        metrics={{ patternName: "Box Breathing", duration: 60, streak: 3 }}
      />,
    );
    expect(streaked).not.toContain("Day 3");
    expect(streaked).not.toContain("streak");
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

  it("offers the optional after choices and the neutral acknowledgment", () => {
    const html = renderToString(
      <PostSessionCelebration metrics={{ patternName: "Box", duration: 60 }} />,
    );
    expect(html).toContain("How is it now?");
    expect(html).toContain("A little lighter");
    expect(html).toContain("About the same");
    expect(html).toContain("Still a lot");
    expect(html).toContain("You can leave it here.");
  });
});

describe("PostSessionCelebration after choices", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mascotProps.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const mount = async (props: Record<string, unknown> = {}) => {
    await act(async () => {
      root.render(
        <PostSessionCelebration
          metrics={{ patternName: "Box Breathing", duration: 60 }}
          {...props}
        />,
      );
    });
  };
  const click = (label: string) => {
    const btn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === label,
    )!;
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };
  const lastMascot = () => mascotProps[mascotProps.length - 1];

  it("defaults to a watchful face — no proud or celebration before a choice", async () => {
    await mount();
    expect(lastMascot().state).toBe("watching");
    expect(lastMascot().reaction).toBeUndefined();
  });

  it("heavier check-in stays tender before a choice, not proud", async () => {
    await mount({ checkInIndex: 4 });
    expect(lastMascot().state).toBe("tender");
    expect(lastMascot().demeanor).toBe("sheltering");
  });

  it("'A little lighter' earns bright/open and a celebrate reaction", async () => {
    await mount();
    click("A little lighter");
    expect(lastMascot().state).toBe("bright");
    expect(lastMascot().demeanor).toBe("open");
    expect((lastMascot().reaction as { name: string }).name).toBe("celebrate");
  });

  it("'About the same' keeps the original map state and settles", async () => {
    await mount({ checkInIndex: 0 });
    click("About the same");
    expect(lastMascot().state).toBe("bright");
    expect((lastMascot().reaction as { name: string }).name).toBe("settle");
  });

  it("'Still a lot' goes tender/sheltering and settles", async () => {
    await mount();
    click("Still a lot");
    expect(lastMascot().state).toBe("tender");
    expect(lastMascot().demeanor).toBe("sheltering");
    expect((lastMascot().reaction as { name: string }).name).toBe("settle");
  });

  it("Done works without an after choice", async () => {
    const onContinue = vi.fn();
    await mount({ onContinue });
    click("Done");
    expect(onContinue).toHaveBeenCalled();
  });
});
