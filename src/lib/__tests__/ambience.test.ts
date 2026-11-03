/**
 * Ambience — material→bed mapping and the on/off pref. Playback itself
 * is a no-op under jsdom (no Audio implementation); the surface under
 * test is what callers ask for.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  ambienceFor,
  isAmbienceEnabled,
  setAmbienceEnabled,
  syncAmbience,
} from "../ambience";

describe("ambienceFor", () => {
  it("maps only the materials that carry a bed", () => {
    expect(ambienceFor("waves")).toBe("/ambience/waves.mp3");
    expect(ambienceFor("snow")).toBe("/ambience/snow.mp3");
    expect(ambienceFor("mist")).toBeNull();
    expect(ambienceFor("sand")).toBeNull();
    expect(ambienceFor("cells")).toBeNull();
    expect(ambienceFor("ink")).toBeNull();
    expect(ambienceFor(null)).toBeNull();
    expect(ambienceFor(undefined)).toBeNull();
  });
});

describe("ambience pref", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to on, flips, and persists", () => {
    expect(isAmbienceEnabled()).toBe(true);
    setAmbienceEnabled(false);
    expect(isAmbienceEnabled()).toBe(false);
    setAmbienceEnabled(true);
    expect(isAmbienceEnabled()).toBe(true);
  });

  it("syncAmbience is a safe no-op without playback support", () => {
    expect(() => {
      syncAmbience("waves", true);
      syncAmbience("waves", false);
      syncAmbience(null, false);
    }).not.toThrow();
  });
});
