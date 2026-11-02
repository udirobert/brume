/**
 * The "Spoken breath cues" choice persists across sessions via
 * localStorage key `brume.audioEnabled`.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/errors/error-reporter", () => ({
  errorReporter: { updateSessionId: vi.fn() },
}));
vi.mock("@/lib/notifications/oneSignal", () => ({
  trackSessionCompleted: vi.fn(),
}));

import { useSessionStore } from "../sessionStore";

const KEY = "brume.audioEnabled";

describe("audioEnabled persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults on when nothing is stored", () => {
    expect(useSessionStore.getState().audioEnabled).toBe(true);
  });

  it("toggleAudio writes the choice to storage", () => {
    useSessionStore.getState().toggleAudio();
    expect(localStorage.getItem(KEY)).toBe("false");
    expect(useSessionStore.getState().audioEnabled).toBe(false);

    useSessionStore.getState().toggleAudio();
    expect(localStorage.getItem(KEY)).toBe("true");
    expect(useSessionStore.getState().audioEnabled).toBe(true);
  });

  it("a stored off choice is honoured on load", async () => {
    localStorage.setItem(KEY, "false");
    vi.resetModules();
    const mod = await import("../sessionStore");
    expect(mod.useSessionStore.getState().audioEnabled).toBe(false);

    localStorage.removeItem(KEY);
    vi.resetModules();
  });
});
