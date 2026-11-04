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

  emitEnded() {
    this.listeners.get("ended")?.();
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
const fetchMock = vi.fn();
const realFetch = globalThis.fetch;
const realCreateObjectURL = URL.createObjectURL;
const realRevokeObjectURL = URL.revokeObjectURL;
let blobSerial = 0;

let mod: VoiceCuesModule;

beforeEach(async () => {
  vi.resetModules();
  FakeAudio.instances = [];
  FakeAudio.failAsMissing = false;
  utterances.length = 0;
  synth.speak.mockClear();
  synth.cancel.mockClear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({
    ok: true,
    blob: async () => new Blob(["wav"]),
  }));

  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.Audio = FakeAudio;
  g.SpeechSynthesisUtterance = FakeUtterance;
  g.speechSynthesis = synth;
  g.fetch = fetchMock;
  URL.createObjectURL = () => `blob:line-${++blobSerial}`;
  URL.revokeObjectURL = () => {};

  mod = await import("../voiceCues");
});

afterAll(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.Audio;
  delete g.SpeechSynthesisUtterance;
  delete g.speechSynthesis;
  globalThis.fetch = realFetch;
  URL.createObjectURL = realCreateObjectURL;
  URL.revokeObjectURL = realRevokeObjectURL;
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

  it("previewCue plays even while voice is off — you audition before enabling", () => {
    mod.setVoiceEnabled(false);
    mod.previewCue("inhale");
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].playCount).toBe(1);
  });

  it("previewCue still falls back on a missing asset while voice is off", async () => {
    mod.setVoiceEnabled(false);
    FakeAudio.failAsMissing = true;
    mod.previewCue("exhale");
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(utterances[0].text).toBe("Breathe out");
  });
});

describe("spoken lines", () => {
  it("posts the line to the voice service and plays the returned audio", async () => {
    mod.speakLine("Evening. We'll take it slow.");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "Evening. We'll take it slow.",
    });
    const line = FakeAudio.instances[0];
    expect(line.src).toMatch(/^blob:/);
    expect(line.playCount).toBe(1);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("falls back to the browser voice when the service is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    mod.speakLine("It's late. We'll take it slow.");
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(utterances[0].text).toBe("It's late. We'll take it slow.");
  });

  it("honours voiceEnabled — an off voice never leaves the device", () => {
    mod.setVoiceEnabled(false);
    mod.speakLine("quiet now");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("previewLine auditions even while voice is off", async () => {
    mod.setVoiceEnabled(false);
    mod.previewLine("audition me");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a phase cue holds while a line is speaking, then works again", async () => {
    mod.speakLine("You came in carrying a lot.");
    await flush();
    const line = FakeAudio.instances[0];
    expect(line.src).toMatch(/^blob:/);

    mod.speakCue("inhale");
    expect(FakeAudio.instances).toHaveLength(1); // suppressed, not queued
    expect(synth.speak).not.toHaveBeenCalled();

    line.emitEnded();
    mod.speakCue("inhale");
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe("/voice/inhale.wav");
  });

  it("stopCues aborts an in-flight line fetch and never falls back", async () => {
    let captured: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, init?: RequestInit) => {
      captured = init?.signal as AbortSignal;
      return new Promise(() => {});
    });
    mod.speakLine("never resolves");
    mod.stopCues();
    expect(captured?.aborted).toBe(true);
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("a second line cuts the first off — one voice at a time", async () => {
    mod.speakLine("first line");
    await flush();
    mod.speakLine("second line");
    await flush();
    const last = FakeAudio.instances[FakeAudio.instances.length - 1];
    expect(last.src).toMatch(/^blob:/);
    expect(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).text).toBe("second line");
  });
});
