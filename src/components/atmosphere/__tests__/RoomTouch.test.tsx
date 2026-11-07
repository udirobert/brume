// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RoomTouch } from "../RoomTouch";
import * as analytics from "@/lib/analytics";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let drawImage: ReturnType<typeof vi.fn>;

beforeEach(() => {
  drawImage = vi.fn();
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage,
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    fillStyle: "",
    globalAlpha: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    return window.setTimeout(() => cb(performance.now()), 0);
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fire(target: Element, type: string, x: number, y: number, pointerType = "mouse") {
  const e = new Event(type, { bubbles: true }) as Event & Record<string, unknown>;
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1, button: 0, pointerType });
  act(() => {
    target.dispatchEvent(e);
  });
}

describe("RoomTouch", () => {
  it("renders one aria-hidden canvas and adds no copy", () => {
    act(() => root.render(<RoomTouch />));
    const canvas = container.querySelector("canvas");
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    expect(container.textContent).toBe("");
  });

  it("a press on empty space starts a stroke and reports counts only", async () => {
    const track = vi.spyOn(analytics, "trackEvent").mockImplementation(() => {});
    act(() => root.render(<RoomTouch />));
    fire(document.body, "pointerdown", 100, 100);
    expect(document.documentElement.dataset.drawing).toBe("1");
    fire(document.body, "pointermove", 140, 100);
    fire(document.body, "pointerup", 140, 100);
    expect(document.documentElement.dataset.drawing).toBeUndefined();
    act(() => root.unmount());
    expect(track).toHaveBeenCalledTimes(1);
    const [name, props] = track.mock.calls[0];
    expect(name).toBe("room_touch");
    expect(Object.keys(props as object).sort()).toEqual(["material", "seconds", "strokes"]);
    expect((props as { strokes: number }).strokes).toBe(1);
    root = createRoot(container);
  });

  it("never starts a stroke on a button, link, field or the mascot", () => {
    const track = vi.spyOn(analytics, "trackEvent").mockImplementation(() => {});
    act(() => root.render(<RoomTouch />));
    for (const html of [
      "<button id=x>Begin</button>",
      "<a id=x href='#'>link</a>",
      "<select id=x></select>",
      "<div data-journey-companion><span id=x></span></div>",
      "<span data-companion-anchor id=x></span>",
    ]) {
      const host = document.createElement("div");
      host.innerHTML = html;
      document.body.appendChild(host);
      fire(host.querySelector("#x")!, "pointerdown", 50, 50);
      expect(document.documentElement.dataset.drawing).toBeUndefined();
      host.remove();
    }
    act(() => root.unmount());
    expect(track).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it("a finger draws only while Home fits; when Home scrolls, touch is a scroll", () => {
    const track = vi.spyOn(analytics, "trackEvent").mockImplementation(() => {});
    act(() => root.render(<RoomTouch />));
    expect(document.documentElement.dataset.roomTouch).toBe("1");
    fire(document.body, "pointerdown", 100, 100, "touch");
    expect(document.documentElement.dataset.drawing).toBe("1");
    fire(document.body, "pointerup", 100, 100, "touch");
    // The page grew taller than the screen: scrolling wins.
    delete document.documentElement.dataset.roomTouch;
    fire(document.body, "pointerdown", 100, 100, "touch");
    expect(document.documentElement.dataset.drawing).toBeUndefined();
    fire(document.body, "pointercancel", 100, 100, "touch");
    // Mouse and pen still draw on a scrolling page.
    fire(document.body, "pointerdown", 100, 100, "pen");
    expect(document.documentElement.dataset.drawing).toBe("1");
    fire(document.body, "pointerup", 100, 100, "pen");
    act(() => root.unmount());
    expect((track.mock.calls[0][1] as { strokes: number }).strokes).toBe(2);
    root = createRoot(container);
  });

  it("sends nothing when the room was never touched", () => {
    const track = vi.spyOn(analytics, "trackEvent").mockImplementation(() => {});
    act(() => root.render(<RoomTouch />));
    act(() => root.unmount());
    expect(track).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});
