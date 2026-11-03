// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { RoomEnvironment } from "../RoomEnvironment";
import { useRoomExperience } from "@/lib/roomExperience";
import { useSessionStore } from "@/stores/sessionStore";
import type { RoomFrame } from "@/lib/atmosphere/roomRenderer";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type StatusFn = (status: "webgl" | "fallback") => void;
interface FakeRenderer {
  resize: ReturnType<typeof vi.fn>;
  draw: (frame: RoomFrame) => void;
  destroy: ReturnType<typeof vi.fn>;
}
let rendererImpl: ((canvas: HTMLCanvasElement, onStatus?: StatusFn) => FakeRenderer | null) | null = null;
const statusCalls: StatusFn[] = [];
const drawnFrames: RoomFrame[] = [];

vi.mock("@/lib/atmosphere/roomRenderer", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/atmosphere/roomRenderer")>();
  return {
    ...mod,
    createRoomRenderer: (canvas: HTMLCanvasElement, onStatus?: StatusFn) => {
      if (onStatus) statusCalls.push(onStatus);
      if (!rendererImpl) return null;
      const r = rendererImpl(canvas, onStatus);
      return r;
    },
  };
});

let container: HTMLDivElement;
let root: Root;
const rafQueue = new Map<number, (now: number) => void>();
let rafSeq = 0;

const runFrames = (times: number[]) => {
  for (const now of times) {
    const entries = [...rafQueue.entries()];
    rafQueue.clear();
    for (const [, cb] of entries) cb(now);
  }
};

const NavProbe = () => {
  const n = useNavigate();
  (window as unknown as { __nav: (t: string) => void }).__nav = n;
  return null;
};

const mount = async (route = "/") => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[route]}>
        <NavProbe />
        <RoomEnvironment />
      </MemoryRouter>,
    );
  });
};

const makeRenderer = () => {
  const r: FakeRenderer = {
    resize: vi.fn(),
    draw: vi.fn((f: RoomFrame) => drawnFrames.push(f)),
    destroy: vi.fn(),
  };
  return r;
};

beforeEach(() => {
  rafQueue.clear();
  rafSeq = 0;
  drawnFrames.length = 0;
  statusCalls.length = 0;
  rendererImpl = null;
  document.body.innerHTML = "";
  delete document.documentElement.dataset.room;
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => null,
  );
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    const id = ++rafSeq;
    rafQueue.set(id, cb);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    rafQueue.delete(id);
  });
  useRoomExperience.getState().reset();
  useSessionStore.getState().resetSession();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  useRoomExperience.getState().reset();
  useSessionStore.getState().resetSession();
  delete document.documentElement.dataset.room;
});

describe("RoomEnvironment", () => {
  it("mounts nothing on non-core routes", async () => {
    await mount("/auth");
    expect(container.querySelector(".brume-room")).toBeNull();
    expect(document.documentElement.dataset.room).toBeUndefined();
  });

  it("falls back to the static CSS material when WebGL is unavailable", async () => {
    await mount("/");
    const wrap = container.querySelector<HTMLElement>(".brume-room")!;
    expect(wrap.dataset.renderer).toBe("fallback");
    expect(wrap.dataset.material).toBe("mist");
    expect(wrap.dataset.motion).toBe("still");
    expect(rafQueue.size).toBe(0);
  });

  it("live renderer runs the loop and draws frames", async () => {
    rendererImpl = makeRenderer;
    await mount("/");
    const wrap = container.querySelector<HTMLElement>(".brume-room")!;
    expect(wrap.dataset.renderer).toBe("webgl");
    expect(wrap.dataset.motion).toBe("live");
    expect(rafQueue.size).toBe(1);
    act(() => runFrames([100, 200, 300]));
    expect(drawnFrames.length).toBeGreaterThan(0);
    expect(drawnFrames[drawnFrames.length - 1].time).toBeGreaterThan(0);
  });

  it("material changes update the wrapper dataset and blend weights", async () => {
    rendererImpl = makeRenderer;
    await mount("/");
    const wrap = container.querySelector<HTMLElement>(".brume-room")!;
    act(() => {
      useRoomExperience.getState().setMaterial("sand");
    });
    expect(wrap.dataset.material).toBe("sand");
    act(() => runFrames([100, 200]));
    const frame = drawnFrames[drawnFrames.length - 1];
    const w = frame.weights!;
    expect(w[2]).toBeGreaterThan(0);
    expect(w[0]).toBeGreaterThan(0);
    expect(w[0] + w[2]).toBeLessThanOrEqual(1.0001);
  });

  it("still mode stops the loop; session bookkeeping keeps running", async () => {
    rendererImpl = makeRenderer;
    await mount("/session");
    useSessionStore.setState({ phase: "active" });
    act(() => runFrames([100]));
    act(() => {
      useRoomExperience.getState().setStill(true);
    });
    expect(rafQueue.size).toBe(0);
    expect(useRoomExperience.getState().practicing).toBe(true);
    act(() => {
      useSessionStore.setState({ phase: "paused" });
    });
    expect(useRoomExperience.getState().paused).toBe(true);
    act(() => {
      useSessionStore.setState({ phase: "active" });
      useSessionStore.setState({ metrics: { duration: 45, currentPhase: "inhale", phaseProgress: 50 } as never });
    });
    expect(useRoomExperience.getState().progress).toBe(0.5);
    expect(rafQueue.size).toBe(0);
  });

  it("pause freezes the loop and holds the last breath; resume does not jump", async () => {
    rendererImpl = makeRenderer;
    await mount("/session");
    useSessionStore.setState({
      phase: "active",
      metrics: { duration: 30, currentPhase: "inhale", phaseProgress: 50 } as never,
    });
    act(() => runFrames([1000, 1100]));
    const breathAtPause = useRoomExperience.getState().breath;
    act(() => {
      useSessionStore.setState({ phase: "paused" });
    });
    expect(rafQueue.size).toBe(0);
    expect(useRoomExperience.getState().breath).toBe(breathAtPause);
    const wrap = container.querySelector<HTMLElement>(".brume-room")!;
    expect(wrap.dataset.motion).toBe("still");
    act(() => {
      useSessionStore.setState({ phase: "active" });
    });
    expect(rafQueue.size).toBe(1);
    act(() => runFrames([2000]));
    expect(useRoomExperience.getState().paused).toBe(false);
  });

  it("leaving the session route clears practicing/paused flags", async () => {
    rendererImpl = makeRenderer;
    await mount("/session");
    act(() => {
      useSessionStore.setState({ phase: "paused" });
    });
    expect(useRoomExperience.getState().paused).toBe(true);
    await act(async () => {
      (window as unknown as { __nav: (t: string) => void }).__nav("/");
    });
    expect(useRoomExperience.getState().paused).toBe(false);
    expect(useRoomExperience.getState().practicing).toBe(false);
  });

  it("a decompress-published practice survives while off the session route", async () => {
    rendererImpl = makeRenderer;
    await mount("/decompress");
    act(() => {
      useRoomExperience.getState().setPractice({
        progress: 0.6,
        breath: 0,
        practicing: true,
        paused: false,
      });
    });
    act(() => runFrames([100, 200]));
    expect(useRoomExperience.getState().practicing).toBe(true);
    expect(useRoomExperience.getState().progress).toBe(0.6);
    expect(drawnFrames[drawnFrames.length - 1].progress).toBe(0.6);
    act(() => {
      useRoomExperience.getState().setPractice({ paused: true });
    });
    expect(rafQueue.size).toBe(0);
    expect(container.querySelector<HTMLElement>(".brume-room")!.dataset.motion).toBe("still");
  });

  it("a stale complete session does not steer progress on home", async () => {
    rendererImpl = makeRenderer;
    useSessionStore.setState({
      phase: "complete",
      metrics: { duration: 9999 } as never,
    });
    await mount("/");
    act(() => runFrames([100, 200]));
    expect(useRoomExperience.getState().progress).toBe(0);
    expect(useRoomExperience.getState().practicing).toBe(false);
  });

  it("a new explicit feel resets local progress and breath", async () => {
    rendererImpl = makeRenderer;
    await mount("/");
    act(() => {
      useRoomExperience.getState().setPractice({ progress: 0.8, breath: 0.6 });
    });
    act(() => {
      useRoomExperience.getState().setFeel(2);
    });
    act(() => runFrames([100]));
    const frame = drawnFrames[drawnFrames.length - 1];
    expect(frame.progress).toBe(0);
    expect(frame.breath).toBe(useRoomExperience.getState().breath);
    expect(useRoomExperience.getState().progress).toBe(0);
  });

  it("paused session still redraws on resize and material picks, with setup reset", async () => {
    rendererImpl = makeRenderer;
    await mount("/session");
    act(() => {
      useSessionStore.setState({
        phase: "active",
        metrics: { duration: 45, currentPhase: "inhale", phaseProgress: 50 } as never,
      });
    });
    act(() => runFrames([100]));
    act(() => {
      useSessionStore.setState({ phase: "paused" });
    });
    expect(rafQueue.size).toBe(0);
    const before = drawnFrames.length;
    act(() => {
      window.dispatchEvent(new window.Event("resize"));
    });
    expect(drawnFrames.length).toBeGreaterThan(before);
    expect(rafQueue.size).toBe(0);
    expect(drawnFrames[drawnFrames.length - 1].progress).toBe(0.5);
    act(() => {
      useRoomExperience.getState().setMaterial("ink");
    });
    expect(drawnFrames[drawnFrames.length - 1].material).toBe("ink");
    expect(rafQueue.size).toBe(0);
    act(() => {
      useSessionStore.setState({
        phase: "setup",
        metrics: { duration: 0 } as never,
      });
    });
    expect(useRoomExperience.getState().progress).toBe(0);
    expect(useRoomExperience.getState().breath).toBe(0);
  });

  it("a new feel does not redraw with stale practice progress in still mode", async () => {
    rendererImpl = makeRenderer;
    await mount("/");
    act(() => {
      useRoomExperience.getState().setPractice({ progress: 0.8, breath: 0.6 });
      useRoomExperience.getState().setStill(true);
    });
    act(() => {
      useRoomExperience.getState().setFeel(2);
    });
    expect(drawnFrames[drawnFrames.length - 1].progress).toBe(0);
  });

  it("context lost drops to fallback; restore rebuilds and redraws", async () => {
    rendererImpl = makeRenderer;
    await mount("/");
    const wrap = container.querySelector<HTMLElement>(".brume-room")!;
    expect(rafQueue.size).toBe(1);
    const status = statusCalls[0];
    act(() => status("fallback"));
    expect(wrap.dataset.renderer).toBe("fallback");
    expect(wrap.dataset.motion).toBe("still");
    expect(rafQueue.size).toBe(0);
    act(() => status("webgl"));
    expect(wrap.dataset.renderer).toBe("webgl");
    expect(drawnFrames.length).toBeGreaterThan(0);
    expect(rafQueue.size).toBe(1);
  });

  it("a hidden document cancels the loop; visible resumes", async () => {
    rendererImpl = makeRenderer;
    await mount("/");
    expect(rafQueue.size).toBe(1);
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new window.Event("visibilitychange"));
    });
    expect(rafQueue.size).toBe(0);
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new window.Event("visibilitychange"));
    });
    expect(rafQueue.size).toBe(1);
  });

  it("unmount cleans up the loop, subscription and room marker", async () => {
    rendererImpl = makeRenderer;
    await mount("/");
    expect(document.documentElement.dataset.room).toBe("1");
    expect(rafQueue.size).toBe(1);
    await act(async () => {
      root.unmount();
    });
    expect(rafQueue.size).toBe(0);
    expect(document.documentElement.dataset.room).toBeUndefined();
  });
});

describe("RoomControls", () => {
  it("exposes a collapsed Change room disclosure naming the material", async () => {
    await mount("/session");
    const details = container.querySelector<HTMLDetailsElement>("details.brume-room-controls")!;
    expect(details.open).toBe(false);
    const summary = details.querySelector("summary")!;
    expect(summary.getAttribute("aria-label")).toBe("Change room, Mist");
  });

  it("material buttons set the override and close the popover", async () => {
    await mount("/session");
    const details = container.querySelector<HTMLDetailsElement>("details.brume-room-controls")!;
    act(() => {
      details.open = true;
      details.dispatchEvent(new window.Event("toggle"));
    });
    const buttons = Array.from(
      details.querySelectorAll<HTMLButtonElement>(".brume-room-controls__item"),
    );
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Auto",
      "Waves",
      "Sand",
      "Cells",
      "Snow",
      "Ink",
      "Still room",
    ]);
    const sand = buttons.find((b) => b.textContent === "Sand")!;
    act(() => {
      sand.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(useRoomExperience.getState().materialOverride).toBe("sand");
    expect(details.open).toBe(false);
    expect(
      container.querySelector<HTMLElement>(".brume-room")!.dataset.material,
    ).toBe("sand");
  });

  it("Still room toggles still mode", async () => {
    await mount("/session");
    const details = container.querySelector<HTMLDetailsElement>("details.brume-room-controls")!;
    act(() => {
      details.open = true;
      details.dispatchEvent(new window.Event("toggle"));
    });
    const still = details.querySelector<HTMLButtonElement>(
      ".brume-room-controls__still",
    )!;
    act(() => {
      still.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(useRoomExperience.getState().still).toBe(true);
    expect(still.getAttribute("aria-pressed")).toBe("true");
  });
});
