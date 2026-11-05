// @vitest-environment jsdom
/**
 * The voice key — what a voice request carries, and when it carries nothing.
 *
 * The server side of this contract is `voice_guard.py`; both halves are the
 * owner's env to set, and the point of these tests is that an unset half is a
 * working, unremarkable request rather than a broken one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { voiceHeaders } from "../voiceKey";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("voiceHeaders", () => {
  it("adds nothing when the build has no key", () => {
    expect(voiceHeaders()).toEqual({});
    expect(voiceHeaders({ "Content-Type": "application/json" })).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("sends the key beside the caller's own headers", () => {
    vi.stubEnv("VITE_VOICE_KEY", "sable");
    expect(voiceHeaders({ "Content-Type": "application/octet-stream" })).toEqual({
      "Content-Type": "application/octet-stream",
      "X-Brume-Voice-Key": "sable",
    });
  });

  it("never lets the key overwrite a Content-Type", () => {
    vi.stubEnv("VITE_VOICE_KEY", "sable");
    const headers = voiceHeaders({ "X-Brume-Voice-Key": "typed-by-a-caller" });
    expect(headers["X-Brume-Voice-Key"]).toBe("sable");
  });
});
