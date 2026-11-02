// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMascot } from "../../../anna/bundle/mascot.js";
import type { BrumeAvatar } from "../../../anna/bundle/mascot-engine.js";
import { BrumeMascot } from "../BrumeMascot";

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
});
