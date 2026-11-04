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
  cueStyle: "spoken" as "spoken" | "breath",
  pause: vi.fn(),
  resume: vi.fn(),
  complete: vi.fn(),
  setAudioEnabled: vi.fn(),
  setCueStyle: vi.fn(),
};

// Real store phase, controllable per test.
let mockPhase = 'active';

vi.mock("@/hooks/useSession", () => ({
  useSession: () => sessionMock,
}));

vi.mock("@/stores/sessionStore", () => ({
  useSessionPhase: () => mockPhase,
}));

// The cycle logic stays real; only the sound side effects are watched.
vi.mock("@/lib/voiceCues", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/voiceCues")>();
  return {
    ...mod,
    previewCue: vi.fn(),
    setCueStyle: vi.fn(),
    setVoiceEnabled: vi.fn(),
  };
});

const trackMock = vi.fn();
vi.mock("@/lib/events", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

import { previewCue, setCueStyle, setVoiceEnabled } from "@/lib/voiceCues";

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
    sessionMock.cueStyle = "spoken";
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

  it("end fires only its callback", () => {
    const onEnd = vi.fn();
    render({ onEndSession: onEnd });

    const end = buttonByLabel("End session");
    click(end);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(sessionMock.complete).not.toHaveBeenCalled();
  });

  describe("the cue glyph", () => {
    const cueBtn = () =>
      buttonByLabel("Breath cues: spoken — tap for breath.");

    it("names the texture you have and the one the next tap brings", () => {
      render();
      expect(cueBtn()).toBeTruthy();
      expect(cueBtn().querySelector("svg")).toBeTruthy();
    });

    it("voice → breath: the store follows and the new texture auditions itself", () => {
      render();
      click(cueBtn());

      expect(sessionMock.setAudioEnabled).toHaveBeenCalledWith(true);
      expect(sessionMock.setCueStyle).toHaveBeenCalledWith("breath");
      expect(setCueStyle).toHaveBeenCalledWith("breath");
      expect(previewCue).toHaveBeenCalledWith("inhale");
      expect(trackMock).toHaveBeenCalledWith("cue_changed", {
        from: "spoken",
        to: "breath",
      });
    });

    it("breath → quiet: the voice is cut and nothing is auditioned", () => {
      sessionMock.cueStyle = "breath";
      render();
      click(
        buttonByLabel("Breath cues: breath — tap for quiet."),
      );

      expect(sessionMock.setAudioEnabled).toHaveBeenCalledWith(false);
      expect(setVoiceEnabled).toHaveBeenCalledWith(false);
      expect(previewCue).not.toHaveBeenCalled();
      expect(trackMock).toHaveBeenCalledWith("cue_changed", {
        from: "breath",
        to: "quiet",
      });
    });

    it("quiet → voice closes the loop, and audio off reads as quiet", () => {
      sessionMock.audioEnabled = false;
      render();
      click(buttonByLabel("Breath cues: quiet — tap for spoken."));

      expect(sessionMock.setAudioEnabled).toHaveBeenCalledWith(true);
      expect(sessionMock.setCueStyle).toHaveBeenCalledWith("spoken");
      // The audition must hear the new texture, not the one being left.
      expect(setCueStyle).toHaveBeenCalledWith("spoken");
      expect(previewCue).toHaveBeenCalledWith("inhale");
      expect(trackMock).toHaveBeenCalledWith("cue_changed", {
        from: "quiet",
        to: "spoken",
      });
    });

    it("disabled or loading leaves the sound alone", () => {
      render({ disabled: true });
      click(cueBtn());
      expect(trackMock).not.toHaveBeenCalled();
      expect(sessionMock.setCueStyle).not.toHaveBeenCalled();
    });
  });
});
