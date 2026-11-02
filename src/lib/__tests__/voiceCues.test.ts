import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

type VoiceCuesModule = typeof import("../voiceCues");

class FakeAudio {
  static instances: FakeAudio[] = [];
  /** When true, play() rejects and sets a media error — a missing asset. */
  static failAsMissing = false;

  src = "";
  preload = "";
  paused = true;
  currentTime = 0;
  error: { code: number } | null = null;
  playCount = 0;
  private listeners = new Map<string, () => void>();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, fn);
  }

  play(): Promise<void> {
    this.playCount++;
    if (FakeAudio.failAsMissing) {
      this.error = { code: 4 };
      return Promise.reject(new DOMException("no source", "NotSupportedError"));
    }
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  emitError() {
    this.error = { code: 4 };
    this.listeners.get("error")?.();
  }
}

const utterances: { text: string; rate: number; pitch: number; volume: number }[] = [];

class FakeUtterance {
  rate = 1;
  pitch = 1;
  volume = 1;
  constructor(public text: string) {
    utterances.push(this as never);
  }
}

const synth = { speak: vi.fn(), cancel: vi.fn() };

let mod: VoiceCuesModule;

beforeEach(async () => {
  vi.resetModules();
  FakeAudio.instances = [];
  FakeAudio.failAsMissing = false;
  utterances.length = 0;
  synth.speak.mockClear();
  synth.cancel.mockClear();

  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.Audio = FakeAudio;
  g.SpeechSynthesisUtterance = FakeUtterance;
  g.speechSynthesis = synth;

  mod = await import("../voiceCues");
});

afterAll(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.Audio;
  delete g.SpeechSynthesisUtterance;
  delete g.speechSynthesis;
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("voiceCues", () => {
  it("is a no-op when voice is disabled", () => {
    mod.setVoiceEnabled(false);
    mod.speakCue("inhale");
    expect(FakeAudio.instances).toHaveLength(0);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("plays the pre-rendered file when the asset exists", () => {
    mod.speakCue("inhale");
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe("/voice/inhale.wav");
    expect(FakeAudio.instances[0].playCount).toBe(1);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("falls back to speechSynthesis when the asset is missing", async () => {
    FakeAudio.failAsMissing = true;
    mod.speakCue("exhale");
    await flush();
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(utterances[0].text).toBe("Breathe out");
    expect(utterances[0].rate).toBeCloseTo(0.9);
    expect(utterances[0].volume).toBeCloseTo(0.85);
  });

  it("falls back via the element error event and remembers the 404", async () => {
    mod.preloadCues();
    FakeAudio.instances.forEach((a) => a.emitError());

    mod.speakCue("hold");
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(utterances[0].text).toBe("Hold");
    expect(FakeAudio.instances.every((a) => a.playCount === 0)).toBe(true);
  });

  it("cancels the in-flight utterance before each new cue", async () => {
    FakeAudio.failAsMissing = true;
    mod.speakCue("inhale");
    await flush();
    mod.speakCue("exhale");
    await flush();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(utterances.map((u) => u.text)).toEqual(["Breathe in", "Breathe out"]);
  });

  it("a cue superseded before its fallback resolves never speaks", async () => {
    FakeAudio.failAsMissing = true;
    mod.speakCue("inhale");
    mod.speakCue("exhale");
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(utterances.map((u) => u.text)).toEqual(["Breathe out"]);
  });

  it("stopCues cancels speech and pauses the playing clip", () => {
    mod.speakCue("inhale");
    const clip = FakeAudio.instances[0];
    expect(clip.paused).toBe(false);
    mod.stopCues();
    expect(synth.cancel).toHaveBeenCalled();
    expect(clip.paused).toBe(true);
  });

  it("stopCues suppresses a pending fallback after playback fails", async () => {
    FakeAudio.failAsMissing = true;
    mod.speakCue("inhale");
    mod.stopCues();
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("disabling voice stops cues and ignores unknown ids", () => {
    mod.setVoiceEnabled(true);
    mod.speakCue("not-a-phase");
    expect(FakeAudio.instances).toHaveLength(0);
    expect(synth.speak).not.toHaveBeenCalled();
  });
});
