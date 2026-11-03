/**
 * SessionControls — regression test for the pause/resume bug:
 * a paused session must resume, never pause again.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

const sessionMock = {
  isActive: true,
  isPaused: false,
  audioEnabled: true,
  pause: vi.fn(),
  resume: vi.fn(),
  complete: vi.fn(),
  toggleAudio: vi.fn(),
};

// Real store phase, controllable per test.
let mockPhase = 'active';

vi.mock("@/hooks/useSession", () => ({
  useSession: () => sessionMock,
}));

vi.mock("@/stores/sessionStore", () => ({
  useSessionPhase: () => mockPhase,
}));

import { SessionControls } from "../SessionControls";

let container: HTMLDivElement;
let root: Root;

function render(props: Record<string, unknown> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(React.createElement(SessionControls, props));
  });
}

function buttonByLabel(label: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === label,
  );
  if (!btn) throw new Error(`no button labelled "${label}"`);
  return btn;
}

function click(btn: HTMLButtonElement) {
  act(() => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("SessionControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.isActive = true;
    sessionMock.isPaused = false;
    sessionMock.audioEnabled = true;
    mockPhase = 'active';
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("hides the play/pause icon before the session has started", () => {
    mockPhase = 'setup';
    render();

    // End still shows; only the play/pause toggle is withheld — there is
    // nothing to pause yet and a play icon would compete with Begin.
    expect(buttonByLabel("End session")).toBeTruthy();
    const toggles = [...container.querySelectorAll("button")].filter(
      (b) => b.getAttribute("aria-label") === "Pause session"
        || b.getAttribute("aria-label") === "Resume session",
    );
    expect(toggles).toHaveLength(0);
  });

  it("hides the dead play/pause icon in the completion beat", () => {
    mockPhase = 'complete';
    render();

    const toggles = [...container.querySelectorAll("button")].filter(
      (b) => b.getAttribute("aria-label") === "Pause session"
        || b.getAttribute("aria-label") === "Resume session",
    );
    expect(toggles).toHaveLength(0);
  });

  it("paused session (isActive=true, isPaused=true) resumes, never pauses", () => {
    sessionMock.isActive = true;
    sessionMock.isPaused = true;
    mockPhase = 'paused';
    render();

    const btn = buttonByLabel("Resume session");
    click(btn);
    expect(sessionMock.resume).toHaveBeenCalledTimes(1);
    expect(sessionMock.pause).not.toHaveBeenCalled();
  });

  it("active unpaused session pauses", () => {
    sessionMock.isActive = true;
    sessionMock.isPaused = false;
    render();

    click(buttonByLabel("Pause session"));
    expect(sessionMock.pause).toHaveBeenCalledTimes(1);
    expect(sessionMock.resume).not.toHaveBeenCalled();
  });

  it("disabled/loading never invokes pause or resume", () => {
    sessionMock.isActive = true;
    sessionMock.isPaused = true;
    render({ disabled: true });
    click(buttonByLabel("Resume session"));
    expect(sessionMock.resume).not.toHaveBeenCalled();
    expect(sessionMock.pause).not.toHaveBeenCalled();
  });

  it("audio and end buttons carry accessible labels; end fires only its callback", () => {
    const onEnd = vi.fn();
    render({ onEndSession: onEnd });

    expect(buttonByLabel("Mute audio")).toBeTruthy();
    const end = buttonByLabel("End session");
    click(end);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(sessionMock.complete).not.toHaveBeenCalled();
  });
});
