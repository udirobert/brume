// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMascot } from "../../../anna/bundle/mascot.js";
import type { BrumeAvatar } from "../../../anna/bundle/mascot-engine.js";
import { BrumeMascot } from "../BrumeMascot";

const reactCalls: string[] = [];
const optionCalls: Record<string, unknown>[] = [];
vi.mock("../../../anna/bundle/mascot.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../anna/bundle/mascot.js")>();
  return {
    ...mod,
    createMascot: (host: HTMLElement, opts?: Parameters<typeof mod.createMascot>[1]) => {
      const handle = mod.createMascot(host, opts);
      const react = handle.react;
      const setOptions = handle.setOptions;
      return {
        ...handle,
        react: (name: string) => {
          reactCalls.push(name);
          react(name as Parameters<typeof react>[0]);
        },
        setOptions: (partial: Record<string, unknown>) => {
          optionCalls.push(partial);
          return setOptions(partial);
        },
      };
    },
  };
});

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function svgOf(host: HTMLElement) {
  return host.querySelector("svg")?.outerHTML ?? "";
}

function makeMediaList(initial = false) {
  const listeners = new Set<(e: unknown) => void>();
  const mql = {
    matches: initial,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_: string, fn: (e: unknown) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: unknown) => void) => listeners.delete(fn),
    addListener: (fn: (e: unknown) => void) => listeners.add(fn),
    removeListener: (fn: (e: unknown) => void) => listeners.delete(fn),
    fire(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((fn) => fn({ matches }));
    },
    listenerCount: () => listeners.size,
  };
  return mql;
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("createMascot adapter", () => {
  it("builds the shared cloud SVG and renders a deterministic frame", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false });
    m.renderAt(7.7);
    const first = svgOf(host);
    m.renderAt(7.7);
    expect(svgOf(host)).toBe(first);
    expect(first).toContain("mascot-fill");
    expect(first).toContain("mascot-mouth");
    m.destroy();
    expect(host.querySelector("svg")).toBeNull();
  });

  it("manual renderAt stays identical while live time and pointer move on", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false, presence: "companion", trackPointer: true });
    m.renderAt(4.8);
    const before = svgOf(host);
    window.dispatchEvent(new window.Event("pointermove"));
    m.renderAt(4.8);
    expect(svgOf(host)).toBe(before);
    m.renderAt(4.8, { reducedMotion: true });
    expect(svgOf(host)).not.toBe(before);
    m.renderAt(4.8, { reducedMotion: true });
    const reducedA = svgOf(host);
    m.renderAt(9.9, { reducedMotion: true });
    expect(svgOf(host)).toBe(reducedA);
    m.destroy();
  });

  it("destroy cancels the pending frame and removes listeners", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let pending = 0;
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => { pending += 1; return pending; });
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { pending -= 1; });
    const m = createMascot(host, { presence: "companion", trackPointer: true });
    expect(rafSpy).toHaveBeenCalled();
    m.destroy();
    m.destroy();
    expect(pending).toBe(0);
    expect(host.querySelector("svg")).toBeNull();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it("state changes apply immediately; repeat setState does not reset blink", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false });
    m.setState("proud");
    expect(host.dataset.state).toBe("proud");
    m.setState("idle");
    m.renderAt(4.8);
    const closed = svgOf(host);
    m.setState("idle");
    m.setState("idle");
    m.renderAt(4.8);
    expect(svgOf(host)).toBe(closed);
    m.destroy();
  });

  it("hidden ancestor suspends the loop and unhide resumes without a setter", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let pending = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => { pending += 1; return pending; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { pending -= 1; });
    const m = createMascot(host);
    expect(pending).toBe(1);
    host.hidden = true;
    await Promise.resolve();
    await Promise.resolve();
    expect(pending).toBe(0);
    host.hidden = false;
    await Promise.resolve();
    await Promise.resolve();
    expect(pending).toBe(1);
    m.destroy();
    expect(pending).toBe(0);
  });

  it("reducedMotion and autoAnimate options cancel the pending frame immediately", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let pending = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => { pending += 1; return pending; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { pending -= 1; });
    const m = createMascot(host);
    expect(pending).toBe(1);
    m.setOptions({ reducedMotion: true });
    expect(pending).toBe(0);
    m.setOptions({ reducedMotion: undefined });
    expect(pending).toBe(1);
    m.setOptions({ autoAnimate: false });
    expect(pending).toBe(0);
    m.destroy();
    expect(pending).toBe(0);
  });

  it("document visibility detaches and re-attaches listeners and the loop", () => {
    const mql = makeMediaList(false);
    vi.stubGlobal("matchMedia", vi.fn(() => mql as unknown as MediaQueryList));
    const host = document.createElement("div");
    document.body.appendChild(host);
    let pending = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => { pending += 1; return pending; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { pending -= 1; });
    const addSpy = vi.spyOn(window, "addEventListener");
    const rmSpy = vi.spyOn(window, "removeEventListener");
    const m = createMascot(host, { presence: "companion", trackPointer: true });
    expect(pending).toBe(1);
    const addsBeforeHide = addSpy.mock.calls.length;
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new window.Event("visibilitychange"));
    expect(pending).toBe(0);
    expect(rmSpy.mock.calls.filter(([n]) => n === "keydown").length).toBeGreaterThan(0);
    const removesAtHide = rmSpy.mock.calls.length;
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new window.Event("visibilitychange"));
    expect(pending).toBe(1);
    expect(addSpy.mock.calls.length).toBeGreaterThan(addsBeforeHide);
    expect(removesAtHide).toBeGreaterThan(0);
    m.destroy();
    vi.unstubAllGlobals();
  });

  it("media change to reduced detaches pointer listeners; back re-attaches", () => {
    const mql = makeMediaList(false);
    const mm = vi.fn(() => mql as unknown as MediaQueryList);
    vi.stubGlobal("matchMedia", mm);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const addSpy = vi.spyOn(window, "addEventListener");
    const rmSpy = vi.spyOn(window, "removeEventListener");
    const m = createMascot(host, { presence: "companion", trackPointer: true });
    expect(addSpy.mock.calls.some(([n]) => n === "pointermove")).toBe(true);
    mql.fire(true);
    expect(rmSpy.mock.calls.filter(([n]) => n === "pointermove").length).toBeGreaterThan(0);
    mql.fire(false);
    m.destroy();
    expect(mm).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    vi.unstubAllGlobals();
  });

  it("quiet presence never attaches pointer or activity listeners", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const addSpy = vi.spyOn(window, "addEventListener");
    const m = createMascot(host, { presence: "quiet", trackPointer: true });
    expect(addSpy.mock.calls.filter(([n]) => ["pointermove", "keydown", "pointerdown"].includes(String(n)))).toHaveLength(0);
    m.destroy();
  });

  it("multiple instances are independent", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    document.body.append(a, b);
    const ma = createMascot(a, { autoAnimate: false });
    const mb = createMascot(b, { autoAnimate: false });
    ma.setState("hum");
    mb.renderAt(0);
    expect(a.dataset.state).toBe("hum");
    expect(b.dataset.state).toBe("idle");
    ma.destroy();
    expect(b.querySelector("svg")).not.toBeNull();
    mb.destroy();
  });

  it("setOptions updates options; clearing breath restores auto breathing", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false, breathing: true });
    m.renderAt(1.75);
    const autoFrame = svgOf(host);
    m.setOptions({ breath: 0 });
    m.renderAt(1.75);
    expect(svgOf(host)).not.toBe(autoFrame);
    m.setOptions({ breath: undefined });
    m.renderAt(1.75);
    expect(svgOf(host)).toBe(autoFrame);
    m.destroy();
  });

  it("setOptions({state}) resets stateAge only when the state changes", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false });
    m.setOptions({ state: "topup" });
    m.renderAt(0.25);
    const puffing = svgOf(host);
    m.setOptions({ state: "topup" });
    m.setOptions({ state: "idle" });
    m.setOptions({ state: "topup" });
    m.renderAt(0.25);
    expect(svgOf(host)).toBe(puffing);
    expect(host.dataset.state).toBe("topup");
    m.setOptions({ state: "bogus" });
    expect(host.dataset.state).toBe("idle");
    m.destroy();
  });

  it("custom avatar geometry is rebuilt inside the same host svg", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false });
    const svg = host.querySelector("svg")!;
    const custom: BrumeAvatar = {
      version: 1,
      body: [
        { type: "circle", cx: 50, cy: 50, r: 30 },
        { type: "circle", cx: 30, cy: 40, r: 12 },
      ],
      highlight: { type: "circle", cx: 60, cy: 30, r: 6 },
      eyes: { leftX: 40, rightX: 60, y: 50, rx: 3, ry: 4 },
      mouths: {
        closed: "M 40 60 L 60 60",
        smile: "M 40 60 Q 50 66 60 60",
        open: "M 45 60 Q 50 66 55 60 Z",
        flat: "M 42 62 L 58 62",
      },
    };
    m.setOptions({ avatar: custom });
    const prims = host.querySelectorAll(".mascot-fill");
    expect(prims).toHaveLength(2);
    expect(prims[0].getAttribute("r")).toBe("30");
    expect(host.querySelectorAll("circle.mascot-hl")).toHaveLength(1);
    expect(host.querySelector("svg")).toBe(svg);
    m.setOptions({ avatar: { garbage: true } as unknown as BrumeAvatar });
    expect(host.querySelectorAll(".mascot-fill")).toHaveLength(3);
    m.renderAt(0);
    expect(host.querySelector(".mascot-eye")!.getAttribute("cx")).toBe("41");
    m.destroy();
  });

  it("transform lives on a mascot-root group, not the svg element", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false });
    m.renderAt(1.2);
    const svg = host.querySelector("svg")!;
    expect(svg.getAttribute("transform")).toBeNull();
    const root = host.querySelector("g.mascot-root")!;
    expect(root).not.toBeNull();
    expect(root.getAttribute("transform")).toContain("translate(0");
    m.destroy();
  });

  it("a state change mid-fade freezes the displayed pose, so chained changes are continuous", () => {
    let nowMs = 1000;
    vi.spyOn(window.performance, "now").mockImplementation(() => nowMs);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false });
    nowMs = 1100;
    m.setState("proud");
    nowMs = 1350;
    m.setOptions({});
    const midFade = svgOf(host);
    m.setState("exhale");
    expect(svgOf(host)).toBe(midFade);
    nowMs = 1600;
    m.setOptions({});
    expect(svgOf(host)).not.toBe(midFade);
    m.destroy();
    vi.restoreAllMocks();
  });

  it("intersection observer suspends and resumes", () => {
    let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    class FakeIO {
      constructor(cb: typeof ioCallback) { ioCallback = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);
    const host = document.createElement("div");
    document.body.appendChild(host);
    let pending = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => { pending += 1; return pending; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { pending -= 1; });
    const m = createMascot(host);
    expect(pending).toBe(1);
    ioCallback!([{ isIntersecting: false }]);
    expect(pending).toBe(0);
    ioCallback!([{ isIntersecting: true }]);
    expect(pending).toBe(1);
    m.destroy();
    expect(pending).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe("createMascot adapter — the expressiveness pass", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    () => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() { return {}; } }) as DOMRect;

  it("lookAt aims the gaze at the target, damped and bounded", () => {
    const host = document.createElement("div");
    const target = document.createElement("div");
    document.body.append(host, target);
    host.getBoundingClientRect = rect(0, 0, 100, 100);
    target.getBoundingClientRect = rect(300, 10, 20, 20);
    const m = createMascot(host, { autoAnimate: false, presence: "quiet" });
    m.renderAt(3);
    const eye = () => host.querySelector(".mascot-eye")!;
    const cxPlain = parseFloat(eye().getAttribute("cx")!);
    const cyPlain = parseFloat(eye().getAttribute("cy")!);
    m.renderAt(3, { lookAt: target });
    const cx = parseFloat(eye().getAttribute("cx")!);
    const cy = parseFloat(eye().getAttribute("cy")!);
    expect(cx).toBeGreaterThan(cxPlain + 1); // target is right of the sprite
    expect(cy).toBeLessThan(cyPlain); // and above it
    expect(cx - cxPlain).toBeLessThanOrEqual(2.5); // bounded by the gaze clamp
    m.destroy();
  });

  it("a collapsed target (no size, no distance) releases the gaze", () => {
    const host = document.createElement("div");
    const target = document.createElement("div");
    document.body.append(host, target);
    host.getBoundingClientRect = rect(0, 0, 0, 0);
    target.getBoundingClientRect = rect(0, 0, 0, 0);
    const m = createMascot(host, { autoAnimate: false, presence: "quiet" });
    m.renderAt(3);
    const plain = svgOf(host);
    m.renderAt(3, { lookAt: target });
    expect(svgOf(host)).toBe(plain);
    m.destroy();
  });

  it("state-owned eye tilts render as mirrored rotations", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const m = createMascot(host, { autoAnimate: false });
    m.renderAt(3, { state: "sleepy" });
    const eyes = host.querySelectorAll(".mascot-eye");
    expect(eyes[0].getAttribute("transform")).toMatch(/rotate\(-6 /);
    expect(eyes[1].getAttribute("transform")).toMatch(/rotate\(6 /);
    m.renderAt(3, { state: "bright" });
    expect(eyes[0].getAttribute("transform")).toMatch(/rotate\(3 /);
    m.renderAt(3, { state: "idle" });
    expect(eyes[0].getAttribute("transform")).toBe("");
    expect(eyes[1].getAttribute("transform")).toBe("");
    m.destroy();
  });
});

describe("BrumeMascot React wrapper", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
  });

  it("mounts the shared SVG and tears it down on unmount", async () => {
    await act(async () => {
      root.render(<BrumeMascot state="watching" presence="companion" trackPointer />);
    });
    const host = container.querySelector(".brume-mascot")!;
    expect(host.querySelector("svg.mascot-svg")).not.toBeNull();
    expect(host.getAttribute("data-state")).toBe("watching");
    await act(async () => {
      root.unmount();
    });
    expect(host.querySelector("svg")).toBeNull();
  });

  it("prop updates flow through options without rebuilding the DOM", async () => {
    await act(async () => {
      root.render(<BrumeMascot state="idle" breath={0.5} />);
    });
    const host = container.querySelector(".brume-mascot")!;
    const svg = host.querySelector("svg")!;
    await act(async () => {
      root.render(<BrumeMascot state="sleepy" breathing />);
    });
    expect(host.querySelector("svg")).toBe(svg);
    expect(host.getAttribute("data-state")).toBe("sleepy");
  });

  it("lookAt prop flows into setOptions and null releases it", async () => {
    optionCalls.length = 0;
    const target = document.createElement("div");
    document.body.appendChild(target);
    await act(async () => {
      root.render(<BrumeMascot lookAt={target} />);
    });
    expect(optionCalls.some((c) => c.lookAt === target)).toBe(true);
    await act(async () => {
      root.render(<BrumeMascot lookAt={null} />);
    });
    expect(optionCalls[optionCalls.length - 1]).toMatchObject({ lookAt: undefined });
  });

  it("reaction prop fires react when the key changes, never on mount", async () => {
    reactCalls.length = 0;
    await act(async () => {
      root.render(<BrumeMascot reaction={{ name: "hop", key: "a" }} />);
    });
    expect(reactCalls).toHaveLength(0);
    await act(async () => {
      root.render(<BrumeMascot reaction={{ name: "hop", key: "b" }} />);
    });
    expect(reactCalls).toEqual(["hop"]);
    await act(async () => {
      root.render(<BrumeMascot reaction={{ name: "settle", key: "b" }} />);
    });
    expect(reactCalls).toEqual(["hop"]);
    await act(async () => {
      root.render(<BrumeMascot reaction={{ name: "settle", key: "c" }} />);
    });
    expect(reactCalls).toEqual(["hop", "settle"]);
  });
});

describe("BrumeMascot tap button", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactCalls.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
  });

  const clickHost = () => {
    const tap = container.querySelector(".brume-mascot-frame__tap")!;
    act(() => {
      tap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("renders a native button with an accessible name when tappable", async () => {
    await act(async () => {
      root.render(<BrumeMascot tapReaction="ready" />);
    });
    const host = container.querySelector(".brume-mascot")!;
    expect(host.tagName).toBe("SPAN");
    const tap = container.querySelector(".brume-mascot-frame__tap")!;
    expect(tap.tagName).toBe("BUTTON");
    expect(tap.getAttribute("aria-label")).toBe("Give Brume a gentle nudge");
    expect(tap.getAttribute("role")).toBeNull();
    expect(tap.getAttribute("tabindex")).toBeNull();
    expect(container.querySelector(".brume-mascot-frame")!.getAttribute("data-tap")).toBe("");
  });

  it("non-interactive mascot stays a plain span", async () => {
    await act(async () => {
      root.render(<BrumeMascot />);
    });
    const host = container.querySelector(".brume-mascot")!;
    expect(host.tagName).toBe("SPAN");
    expect(host.getAttribute("role")).toBeNull();
    expect(host.getAttribute("tabindex")).toBeNull();
    expect(container.querySelector(".brume-mascot-frame__tap")).toBeNull();
    expect(container.querySelector(".brume-mascot-frame")!.getAttribute("data-tap")).toBeNull();
  });

  it("native click fires the supplied tap reaction", async () => {
    await act(async () => {
      root.render(<BrumeMascot tapReaction="ready" />);
    });
    clickHost();
    expect(reactCalls).toEqual(["ready"]);
  });

  it("repeated taps keep escalating only while open and allowed", async () => {
    await act(async () => {
      root.render(<BrumeMascot tapReaction="ready" />);
    });
    clickHost();
    clickHost();
    clickHost();
    expect(reactCalls).toEqual(["ready", "ready", "hop"]);
    clickHost();
    clickHost();
    expect(reactCalls[4]).toBe("celebrate");
  });

  it("repeated heavy taps never hop or celebrate", async () => {
    await act(async () => {
      root.render(
        <BrumeMascot tapReaction="settle" demeanor="sheltering" allowTapEscalation={false} />,
      );
    });
    for (let i = 0; i < 7; i++) clickHost();
    expect(reactCalls).toEqual(["settle", "settle", "settle", "settle", "settle", "settle", "settle"]);
    expect(reactCalls).not.toContain("hop");
    expect(reactCalls).not.toContain("celebrate");
  });

  it("a sheltering demeanor blocks escalation even when allowed", async () => {
    await act(async () => {
      root.render(<BrumeMascot tapReaction="ready" demeanor="attentive" />);
    });
    clickHost();
    clickHost();
    clickHost();
    expect(reactCalls).toEqual(["ready", "ready", "ready"]);
  });

  it("toggling tapReaction off and on keeps the same engine SVG", async () => {
    await act(async () => {
      root.render(<BrumeMascot tapReaction="ready" />);
    });
    const host = container.querySelector(".brume-mascot")!;
    const svg = host.querySelector("svg")!;
    await act(async () => {
      root.render(<BrumeMascot />);
    });
    expect(container.querySelector(".brume-mascot-frame__tap")).toBeNull();
    expect(host.querySelector("svg")).toBe(svg);
    await act(async () => {
      root.render(<BrumeMascot tapReaction="settle" />);
    });
    expect(host.querySelector("svg")).toBe(svg);
    clickHost();
    expect(reactCalls).toEqual(["settle"]);
  });
});
