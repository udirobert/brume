/**
 * SessionPreview — camera is opt-in: mount, demo toggle, and camera-free
 * start never request a stream; Enable camera calls the parent's
 * acquisition exactly once; denial still allows camera-free start.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";

const requestStreamMock = vi.fn();

vi.mock("@/stores/cameraStore", () => ({
  useCameraStore: () => ({
    stream: null,
    status: "idle",
    error: null,
    requestStream: requestStreamMock,
    releaseStream: vi.fn(),
    hasPermission: false,
  }),
}));

import { SessionPreview } from "../SessionPreview";

const pattern = {
  name: "Box",
  phases: { inhale: 4, hold: 4, exhale: 4, pause: 4 },
};

function render(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(SessionPreview, {
          patternName: "Box",
          pattern,
          onStart: vi.fn(),
          enableCamera: true,
          ...props,
        }),
      ),
    );
  });
  return { container, root };
}

function byText(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === text,
  );
  if (!btn) throw new Error(`no button "${text}"`);
  return btn;
}

describe("SessionPreview camera opt-in", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    requestStreamMock.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("mount and hands-free demo never request a camera stream", () => {
    ({ container, root } = render());
    expect(requestStreamMock).not.toHaveBeenCalled();
    act(() => {
      byText(container, "Try hands-free preview").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(container.textContent).toContain("Simulation — no camera used");
    expect(requestStreamMock).not.toHaveBeenCalled();
  });

  it("Enable camera calls the parent acquisition once; denial still allows camera-free start", async () => {
    const onEnableCamera = vi.fn().mockResolvedValue(null);
    const onStart = vi.fn();
    ({ container, root } = render({ onEnableCamera, onStart }));
    await act(async () => {
      byText(container, "Enable camera").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(onEnableCamera).toHaveBeenCalledTimes(1);
    expect(requestStreamMock).not.toHaveBeenCalled(); // never the raw fallback
    act(() => {
      byText(container, "Breathe without camera").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(onStart).toHaveBeenCalledWith(false);
  });

  it("enableCamera=false never forwards a stream-enabled start", () => {
    const onStart = vi.fn();
    ({ container, root } = render({ enableCamera: false, onStart }));
    act(() => {
      byText(container, "Breathe without camera").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(onStart).toHaveBeenCalledWith(false);
    expect(requestStreamMock).not.toHaveBeenCalled();
  });
});
