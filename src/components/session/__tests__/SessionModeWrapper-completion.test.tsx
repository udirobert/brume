/**
 * SessionModeWrapper — completion payload regression: the supplied real
 * startTime is preserved for history (not recomputed as now-duration) and
 * the paused-excluded duration reaches saveSession and router state.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";

const saveSession = vi.fn().mockReturnValue("sess-1");
const navigate = vi.fn();
let capturedComplete: ((m: Record<string, unknown>) => void) | null = null;

vi.mock("@/lib/offline/OfflineManager", () => ({
  useOfflineManager: () => ({
    saveSession,
    syncStatus: { isOnline: false },
  }),
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("../ResponsiveEnhancedSession", () => ({
  ResponsiveEnhancedSession: (props: {
    onSessionComplete: (m: Record<string, unknown>) => void;
  }) => {
    capturedComplete = props.onSessionComplete;
    return null;
  },
}));
vi.mock("@/lib/errors/error-boundary", () => ({
  SessionErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
vi.mock("@/lib/errors/error-reporter", () => ({
  errorReporter: { updateSessionId: vi.fn() },
}));

import { SessionModeWrapper } from "../SessionModeWrapper";
import { BREATHING_PATTERNS } from "@/lib/breathingPatterns";

describe("SessionModeWrapper completion payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedComplete = null;
    localStorage.clear();
  });

  it("preserves the real startTime and active duration in save + route state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/session?pattern=box"] },
          React.createElement(SessionModeWrapper),
        ),
      );
    });
    expect(capturedComplete).toBeTruthy();

    // Session ran with a long pause: wall time 64s, active time 4s.
    const realStart = new Date("2026-10-17T10:00:00Z"); // NOT Date.now()-duration
    await act(async () => {
      capturedComplete!({
        pattern: { id: "box", name: BREATHING_PATTERNS.box.name },
        patternName: BREATHING_PATTERNS.box.name,
        sessionDuration: 4,
        duration: 4,
        elapsedTime: 4000,
        cycleCount: 0,
        breathHoldTime: 0,
        startTime: realStart,
        cameraUsed: false,
        sessionType: "enhanced",
      });
    });

    expect(saveSession).toHaveBeenCalledTimes(1);
    const saved = saveSession.mock.calls[0][0];
    expect(saved.startTime).toEqual(realStart);
    expect(saved.duration).toBe(4);
    expect(navigate).toHaveBeenCalledWith(
      "/post-session",
      expect.objectContaining({
        state: expect.objectContaining({ sessionDuration: 4 }),
      }),
    );

    await act(async () => root.unmount());
    container.remove();
  });
});
