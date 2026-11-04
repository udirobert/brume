/**
 * PostSessionCelebration — no scores, no verification marks.
 * The bottom region morphs in place between main / words / details;
 * duration lives inside the details view; zero stays zero.
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
    const {
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...dom
    } = rest as Record<string, unknown>;
    return <div {...dom}>{children as React.ReactNode}</div>;
  };
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: new Proxy({}, { get: () => passthrough }),
    useReducedMotion: () => true,
  };
});
vi.mock("@/lib/notifications/oneSignal", () => ({
  trackCredentialShared: vi.fn(),
}));

import { PostSessionCelebration } from "../PostSessionCelebration";

describe("PostSessionCelebration", () => {
  it("opens on the compact main view — actions only, no score", () => {
    const html = renderToString(
      <PostSessionCelebration metrics={{ patternName: "Box Breathing", duration: 300 }} />,
    );
    expect(html).toContain("Done");
    expect(html).toContain("Put it into words");
    expect(html).toContain("Practice details");
    expect(html).not.toContain("stillness");
    expect(html).not.toContain("Seen");
    expect(html).not.toContain("credential");
    expect(html).not.toContain("Mint");
    // The stats stay folded away — the landing view must not grow.
    expect(html).not.toContain("practice time");
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

describe("PostSessionCelebration morph region", () => {
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
  const button = (label: string) =>
    [...container.querySelectorAll("button")].find(
      (b) => b.textContent === label,
    );
  const click = (label: string) => {
    act(() => {
      button(label)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };
  const text = () => container.textContent ?? "";

  it("keeps the real duration inside the details view labelled practice time", async () => {
    await mount({ metrics: { patternName: "Box Breathing", duration: 300 } });
    click("Practice details");
    expect(text()).toContain("5m");
    expect(text()).toContain("practice time");
    expect(text()).toContain("Practice details");
    // The morph replaced the main view, not appended below it.
    expect(button("Done")).toBeUndefined();
  });

  it("never fabricates a minimum duration for zero", async () => {
    await mount({ metrics: { patternName: "Box Breathing", duration: 0 } });
    click("Practice details");
    expect(text()).toContain("0s");
    expect(text()).not.toContain("1s");
  });

  it("shows cycle count with singular/plural only when supplied", async () => {
    await mount({ metrics: { patternName: "Box Breathing", duration: 60, cycles: 1 } });
    click("Practice details");
    expect(text()).toContain("1 cycle");
    expect(text()).not.toContain("1 cycles");
    click("Back");

    await act(async () => {
      root.render(
        <PostSessionCelebration
          metrics={{ patternName: "Box Breathing", duration: 60, cycles: 8 }}
        />,
      );
    });
    click("Practice details");
    expect(text()).toContain("8 cycles");
    click("Back");

    await act(async () => {
      root.render(
        <PostSessionCelebration
          metrics={{ patternName: "Box Breathing", duration: 60 }}
        />,
      );
    });
    click("Practice details");
    expect(text()).not.toContain("cycles");
  });

  it("'Put it into words' morphs to the composer in place", async () => {
    await mount({ checkInIndex: 0 });
    click("Put it into words");
    expect(text()).toContain("Say it in a sentence");
    expect(text()).toContain("Someone close");
    expect(text()).toContain("Work");
    expect(text()).toContain("Just for me");
    expect(text()).toContain("Edit it freely — nothing is sent without you.");
    // Old view gone — nothing stacked below.
    expect(button("Done")).toBeUndefined();
    expect(button("Practice details")).toBeUndefined();
    // The composed sentence is already in the textarea.
    const textarea = container.querySelector("textarea")!;
    expect(textarea.value).toContain("I'm okay as I am today.");
  });

  it("a For choice recomposes the sentence until it's edited", async () => {
    await mount({ checkInIndex: 0 });
    click("Put it into words");
    const textarea = container.querySelector("textarea")!;
    click("Work");
    expect(textarea.value).toContain("Heads up: I'm okay as I am today.");
    // Once the person edits, the sentence is theirs.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!;
      setter.call(textarea, "My own words.");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    click("Someone close");
    expect(textarea.value).toBe("My own words.");
  });

  it("Back returns to the main view unchanged", async () => {
    await mount();
    click("Put it into words");
    click("Back");
    expect(button("Done")).toBeTruthy();
    expect(button("Put it into words")).toBeTruthy();
    expect(button("Practice details")).toBeTruthy();
    expect(text()).not.toContain("Say it in a sentence");
  });

  it("Share falls back to copying the message when canvas/share are unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await mount({ checkInIndex: 0 });
    click("Put it into words");
    await act(async () => {
      button("Share")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("I'm okay as I am today."),
    );
  });

  it("includes the quiet room link when 'Include a quiet room link' is toggled on", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await mount({ checkInIndex: 0, patternId: "reset" });
    click("Put it into words");
    click("Include a quiet room link");
    await act(async () => {
      button("Copy message")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("https://brumeapp.netlify.app/session?pattern=reset&via=invite"),
    );
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
