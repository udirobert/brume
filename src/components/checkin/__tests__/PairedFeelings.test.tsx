// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let reducedFlag = false;
vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  const pass = ({ children, ...rest }: Record<string, unknown>) => {
    const { initial, animate, transition, exit, ...dom } = rest as Record<
      string,
      unknown
    >;
    return (
      <span
        {...dom}
        data-initial={JSON.stringify(initial)}
        data-animate={JSON.stringify(animate)}
      >
        {children as React.ReactNode}
      </span>
    );
  };
  return {
    ...mod,
    motion: new Proxy({}, { get: () => pass }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => reducedFlag,
  };
});

import { PairedFeelings } from "../PairedFeelings";

let container: HTMLDivElement;
let root: Root;
let chosen: (number | null)[];

function Harness({ showHint = true, external }: { showHint?: boolean; external?: number | null }) {
  const [sel, setSel] = useState<number | null>(external ?? null);
  return (
    <PairedFeelings
      selectedIndex={sel}
      showHint={showHint}
      onChoose={(i) => {
        chosen.push(i);
        setSel(i);
      }}
    />
  );
}

const buttons = () =>
  [...container.querySelectorAll<HTMLButtonElement>(".brume-choice--flip")];
const click = (i: number) => {
  const b = buttons()[i];
  act(() => {
    b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

beforeEach(() => {
  chosen = [];
  reducedFlag = false;
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks(); // spies from one test must not leak into the next
});

describe("PairedFeelings", () => {
  it("renders exactly five chips with the initial faces", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    expect(buttons()).toHaveLength(5);
    expect(
      buttons().map((b) => b.querySelector(".brume-choice__face")!.textContent),
    ).toEqual(["Light", "Drained", "Settled", "Lonely", "Overwhelmed"]);
    expect(chosen).toHaveLength(0);
  });

  it("select-flip-switch-and-back keeps the same button and face memory", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    const lightBtn = buttons()[0];
    lightBtn.focus();
    click(0);
    expect(chosen).toEqual([5]);
    expect(buttons()[0]).toBe(lightBtn);
    expect(document.activeElement).toBe(lightBtn);
    click(0);
    expect(chosen).toEqual([5, 6]);
    expect(buttons()[0].textContent).toContain("Heavy");
    click(1);
    expect(chosen).toEqual([5, 6, 8]);
    click(0);
    expect(chosen[3]).toBe(6);
    click(0);
    expect(chosen[4]).toBe(5);
    expect(buttons()[0]).toBe(lightBtn);
  });

  it("aria: pressed, label, opposite description and live region", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    click(4);
    const sel = buttons()[4];
    expect(sel.getAttribute("aria-pressed")).toBe("true");
    expect(sel.getAttribute("aria-label")).toBe("Overwhelmed");
    const desc = document.getElementById(sel.getAttribute("aria-describedby")!.split(" ")[0])!;
    expect(desc.textContent).toContain("Activate again for Hopeful.");
    expect(container.querySelector("[aria-live]")!.textContent).toBe(
      "Overwhelmed selected.",
    );
    const unsel = buttons()[0];
    expect(unsel.getAttribute("aria-pressed")).toBe("false");
    expect(unsel.getAttribute("aria-describedby")).toBeNull();
  });

  it("external selection change updates only the matching face", async () => {
    function Controlled() {
      const [sel, setSel] = useState<number | null>(null);
      (window as unknown as { __set: (n: number) => void }).__set = setSel;
      return (
        <PairedFeelings selectedIndex={sel} onChoose={(i) => setSel(i)} />
      );
    }
    await act(async () => {
      root.render(<Controlled />);
    });
    await act(async () => {
      (window as unknown as { __set: (n: number) => void }).__set(13);
    });
    expect(buttons()[4].textContent).toContain("Hopeful");
    expect(buttons()[0].textContent).toContain("Light");
  });

  it("hint shows on first selection, flip dismisses, storage blocks re-show", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    click(0);
    expect(container.querySelector(".brume-flip-hint")).not.toBeNull();
    expect(container.querySelector("[role=tooltip]")!.textContent).toBe(
      "Tap again to see the other side.",
    );
    click(0);
    expect(container.querySelector(".brume-flip-hint")).toBeNull();
    expect(chosen).toEqual([5, 6]);
  });

  it("seen storage hides hint on remount; blocked storage does not crash", async () => {
    window.localStorage.setItem("brume.feelingFlipHint.v1", "1");
    await act(async () => {
      root.render(<Harness />);
    });
    click(0);
    expect(container.querySelector(".brume-flip-hint")).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await act(async () => {
      root.unmount();
    });
    container.innerHTML = "";
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });
    click(0);
    expect(container.querySelector(".brume-flip-hint")).not.toBeNull();
    expect(chosen[chosen.length - 1]).toBe(5);
  });

  it("showHint=false shows nothing", async () => {
    await act(async () => {
      root.render(<Harness showHint={false} />);
    });
    click(0);
    expect(container.querySelector(".brume-flip-hint")).toBeNull();
    expect(chosen).toEqual([5]);
  });

  it("a first visit peeks one chip's other face, then restores it — once ever", async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(<Harness />);
      });
      const face = () => buttons()[0].querySelector(".brume-choice__face")!.textContent;
      expect(face()).toBe("Light");
      await act(async () => { vi.advanceTimersByTime(4100); });
      expect(face()).toBe("Heavy");
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(face()).toBe("Light");
      expect(window.localStorage.getItem("brume.flipPeek.v1")).toBe("1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("the peek does not fire for a returning selection or a seen flag", async () => {
    window.localStorage.setItem("brume.flipPeek.v1", "1");
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(<Harness />);
      });
      await act(async () => { vi.advanceTimersByTime(6000); });
      expect(
        buttons()[0].querySelector(".brume-choice__face")!.textContent,
      ).toBe("Light");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reduced motion uses opacity only; fresh chips have no initial transform", async () => {
    reducedFlag = true;
    await act(async () => {
      root.render(<Harness />);
    });
    const face = container.querySelector(".brume-choice__face")!;
    expect(face.getAttribute("data-initial")).toBe("false");
    click(0);
    click(0);
    const faces = [...container.querySelectorAll(".brume-choice__face")];
    const flipped = faces.find((f) => f.getAttribute("data-initial") !== "false")!;
    expect(JSON.parse(flipped.getAttribute("data-initial")!)).toEqual({ opacity: 0 });
    expect(JSON.parse(flipped.getAttribute("data-animate")!)).toEqual({ opacity: 1 });
  });
});

// --- Hold-to-talk on the mic ------------------------------------------------
vi.mock("@/lib/voiceCheckin", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/voiceCheckin")>();
  return {
    ...real,
    voiceCheckinSupported: () => true,
    listenOnce: (...args: unknown[]) => micMock.listenOnce(...(args as [])),
  };
});

const micMock = vi.hoisted(() => ({
  listenOnce: vi.fn(),
  resolve: undefined as ((v: unknown) => void) | undefined,
  arm() {
    // mockReset drops any leftover one-shot resolves from a previous test.
    this.listenOnce.mockReset();
    this.listenOnce.mockImplementation(
      (_interim: unknown, signal: AbortSignal, ctl: { hold: boolean }) => {
        this.lastCtl = ctl;
        this.lastSignal = signal;
        return new Promise((res) => {
          this.resolve = (v: unknown) => res(v);
          signal.addEventListener("abort", () =>
            res({ transcript: "", index: null, suggest: null, pattern: null, failure: null }),
          );
        });
      },
    );
  },
  lastCtl: null as { hold: boolean } | null,
  lastSignal: null as AbortSignal | null,
}));

describe("mic — hold to talk, tap to toggle", () => {
  beforeEach(() => {
    window.localStorage.clear(); // mode/hint flags must not leak between tests
    micMock.arm();
  });

  const mountPlain = async () => {
    await act(async () => {
      root.render(
        <PairedFeelings selectedIndex={null} onChoose={(i: number | null) => chosen.push(i)} showHint={false} />,
      );
    });
  };
  const mic = () => container.querySelector<HTMLButtonElement>(".brume-mic")!;
  const pointer = (type: string, el: HTMLElement) =>
    act(() => {
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7 }));
    });

  it("a held press keeps the mic open past a quiet sentence, until release", async () => {
    await mountPlain();
    vi.useFakeTimers();
    try {
      pointer("pointerdown", mic());
      expect(micMock.listenOnce).toHaveBeenCalledTimes(1);
      expect(micMock.lastCtl!.hold).toBe(true);
      await act(async () => { vi.advanceTimersByTime(400); });
      expect(mic().classList.contains("is-holding")).toBe(true);
      // Finger still down: no abort yet.
      expect(micMock.lastSignal!.aborted).toBe(false);
      pointer("pointerup", mic());
      expect(micMock.lastSignal!.aborted).toBe(true);
      // Resolve as if the last words landed.
      await act(async () => {
        micMock.resolve!({ transcript: "I am tense", index: 1, suggest: null, pattern: null, failure: null });
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("a quick press settles into a tap: the mic stays open until stopped", async () => {
    await mountPlain();
    vi.useFakeTimers();
    try {
      pointer("pointerdown", mic());
      pointer("pointerup", mic()); // under HOLD_TAP_MS
      expect(micMock.lastSignal!.aborted).toBe(false);
      expect(micMock.lastCtl!.hold).toBe(false);
      // The settle says how it ends — the cleared timer never could.
      expect(container.querySelector(".brume-voice-heard")!.textContent).toContain(
        "tap again when done",
      );
      expect(mic().textContent).toContain("tap to stop");
      // Second press ends the tap-mode listen.
      pointer("pointerdown", mic());
      expect(micMock.lastSignal!.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a stolen release (pointercancel) settles the hold instead of stranding it", async () => {
    await mountPlain();
    vi.useFakeTimers();
    try {
      pointer("pointerdown", mic());
      // The permission sheet swallows the release: pointercancel arrives.
      pointer("pointercancel", mic());
      // A hold with no finger behind it must not stay a hold.
      expect(micMock.lastCtl!.hold).toBe(false);
      expect(micMock.lastSignal!.aborted).toBe(false);
      expect(container.querySelector(".brume-voice-heard")!.textContent).toContain(
        "tap again when done",
      );
      expect(mic().textContent).toContain("tap to stop");
      // And a press still ends it.
      pointer("pointerdown", mic());
      expect(micMock.lastSignal!.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("after a first tapped match, teaches the hold once and only once", async () => {
    const done = { transcript: "tense", index: 1, suggest: null, pattern: null, failure: null };
    micMock.listenOnce.mockResolvedValueOnce(done).mockResolvedValueOnce(done);
    await mountPlain();
    vi.useFakeTimers();
    try {
      // Tap mode: quick press and release.
      pointer("pointerdown", mic());
      pointer("pointerup", mic());
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      // The tip lands after the offer, and exactly once.
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(container.textContent).toContain("keep your finger on it");
      expect(window.localStorage.getItem("brume.voiceHoldHint.v1")).toBe("1");
      // Second tapped match: the tip stays quiet.
      pointer("pointerdown", mic());
      pointer("pointerup", mic());
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(container.textContent).not.toContain("keep your finger on it");
    } finally {
      vi.useRealTimers();
    }
  });

  it("in tap mode, releasing changes nothing and a second press ends it", async () => {
    window.localStorage.setItem("brume.micMode.v1", "tap");
    await mountPlain();
    vi.useFakeTimers();
    try {
      pointer("pointerdown", mic());
      expect(micMock.lastCtl!.hold).toBe(false); // hands-free from the first press
      pointer("pointerup", mic());
      expect(micMock.lastSignal!.aborted, "release must not end a tap-mode listen").toBe(false);
      pointer("pointerdown", mic()); // the second press ends it
      expect(micMock.lastSignal!.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tap mode is never nudged toward hold", async () => {
    window.localStorage.setItem("brume.micMode.v1", "tap");
    micMock.listenOnce.mockResolvedValueOnce({
      transcript: "tense", index: 1, suggest: null, pattern: null, failure: null,
    });
    await mountPlain();
    vi.useFakeTimers();
    try {
      pointer("pointerdown", mic());
      pointer("pointerup", mic());
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(container.textContent).not.toContain("keep your finger on it");
      expect(window.localStorage.getItem("brume.voiceHoldHint.v1")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a failed listen names the failure instead of a generic miss", async () => {
    micMock.listenOnce.mockResolvedValueOnce({
      transcript: "", index: null, suggest: null, pattern: null, failure: "mic_blocked",
    });
    await mountPlain();
    pointer("pointerdown", mic());
    await act(async () => { vi.waitFor(() => expect(micMock.listenOnce).toHaveBeenCalled()); });
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain("mic is off for this site");
  });

  const help = () => container.querySelector<HTMLDivElement>(".brume-voice-help");
  const failBlocked = () =>
    micMock.listenOnce.mockResolvedValueOnce({
      transcript: "", index: null, suggest: null, pattern: null, failure: "mic_blocked",
    });

  it("the blocked-mic help card stays put, says the fix for this device, and can be dismissed", async () => {
    failBlocked();
    await mountPlain();
    pointer("pointerdown", mic());
    pointer("pointerup", mic());
    await act(async () => { vi.waitFor(() => expect(help()).not.toBeNull()); });
    // jsdom's UA is desktop-ish: site settings guidance + the way out.
    expect(help()!.textContent).toContain("switched off for this site");
    expect(help()!.textContent).toContain("Or just tap a word.");
    // It does not dissolve: transcripts are theirs, help is ours. Fast-forward
    // past the transcript's 6 s clear window and it must still be there.
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(7000); });
    vi.useRealTimers();
    expect(help()).not.toBeNull();
    // Dismiss.
    await act(async () => {
      help()!.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(help()).toBeNull();
  });

  it("trying again retires the card, and blocked reports itself as blocked", async () => {
    const states: string[] = [];
    await act(async () => {
      root.render(
        <PairedFeelings
          selectedIndex={null}
          onChoose={(i: number | null) => chosen.push(i)}
          onVoiceState={(st) => states.push(st)}
          showHint={false}
        />,
      );
    });
    failBlocked();
    pointer("pointerdown", mic());
    pointer("pointerup", mic());
    await act(async () => { vi.waitFor(() => expect(help()).not.toBeNull()); });
    expect(states).toContain("blocked");
    // The next press clears the card — the person is trying, help is done.
    pointer("pointerdown", mic());
    expect(help()).toBeNull();
    pointer("pointerup", mic());
  });

  // The real hold flow: the finger stays past HOLD_TAP_MS (else the press
  // downgrades to a tap and the one-time hold tip joins the scene), and
  // release finalizes the turn with the words.
  const speakMatch = async (index: number, transcript: string) => {
    micMock.listenOnce.mockResolvedValueOnce({
      transcript, index, suggest: null, pattern: null, failure: null,
    });
    pointer("pointerdown", mic());
    await act(async () => { vi.advanceTimersByTime(400); });
    pointer("pointerup", mic());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  };
  const offer = () =>
    container.querySelector<HTMLDivElement>(".brume-voice-offer:not(.brume-voice-offer--kept)");
  const kept = () => container.querySelector<HTMLDivElement>(".brume-voice-offer--kept");

  it("a spoken match that already shows still leaves a standing invitation", async () => {
    // The exact reported case: "i am feeling drained" — Drained is the
    // energy pair's initial face, so there is no flip to see. The room
    // must not go silent anyway.
    await mountPlain();
    vi.useFakeTimers();
    try {
      await speakMatch(8, "i am feeling drained");
      expect(offer()?.textContent).toContain("Drained");
      expect(offer()?.textContent).toContain("tap to keep it");
      expect(container.querySelector(".is-suggested")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a word already face-up is acknowledged with a spin, not silence", async () => {
    await mountPlain();
    vi.useFakeTimers();
    try {
      await speakMatch(8, "i am feeling drained");
      // Drained is the energy pair's initial face: no flip possible, so
      // the chip spins and the invitation still stands.
      expect(buttons()[1].classList.contains("is-confirming")).toBe(true);
      expect(offer()?.textContent).toContain("Drained");
      expect(offer()?.textContent).toContain("tap to keep it");
      // The spin retires itself just past its 0.9 s.
      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(buttons()[1].classList.contains("is-confirming")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a word already chosen spins its chip and adds no invitation", async () => {
    await act(async () => {
      root.render(
        <PairedFeelings
          selectedIndex={8}
          onChoose={(i: number | null) => chosen.push(i)}
          showHint={false}
        />,
      );
    });
    vi.useFakeTimers();
    try {
      await speakMatch(8, "still drained");
      expect(buttons()[1].classList.contains("is-confirming")).toBe(true);
      expect(offer()).toBeNull(); // that word is already theirs to carry
    } finally {
      vi.useRealTimers();
    }
  });

  it("their words dissolve; the invitation stays until a chip is tapped", async () => {
    await mountPlain();
    vi.useFakeTimers();
    try {
      await speakMatch(6, "heavy day");
      // The matched chip turns face-up and glows.
      expect(buttons()[0].textContent).toContain("Heavy");
      expect(buttons()[0].classList.contains("is-suggested")).toBe(true);
      // Past the transcript's 6 s clear window the heard line is empty…
      await act(async () => { vi.advanceTimersByTime(7000); });
      const heardSeat = container.querySelector(".brume-voice-heard")!;
      expect(heardSeat.textContent!.trim()).toBe(""); // the seat stays — nothing may jump
      expect(heardSeat.classList.contains("is-empty")).toBe(true);
      // …and the invitation is still standing.
      expect(offer()?.textContent).toContain("Heavy");
      expect(offer()?.textContent).toContain("tap to keep it");
      // Tapping the word commits it — and retires the invitation.
      click(0);
      expect(chosen.at(-1)).toBe(6);
      expect(offer()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("taking the invitation leaves a kept word, which retires itself", async () => {
    await mountPlain();
    vi.useFakeTimers();
    try {
      await speakMatch(6, "heavy day");
      await act(async () => {
        offer()!.querySelector<HTMLButtonElement>(".brume-voice-offer__take")!.click();
      });
      expect(chosen.at(-1)).toBe(6);
      expect(offer()).toBeNull();
      // The seat answers "was that right?" — then lets go.
      expect(kept()?.textContent).toContain("Heavy — kept");
      await act(async () => { vi.advanceTimersByTime(3000); });
      expect(kept()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("tapping the invitation chooses its word, exactly like the chip", async () => {
    await mountPlain();
    vi.useFakeTimers();
    try {
      await speakMatch(6, "heavy day");
      await act(async () => {
        offer()!.querySelector<HTMLButtonElement>(".brume-voice-offer__take")!.click();
      });
      expect(chosen.at(-1)).toBe(6);
      expect(offer()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the invitation retires on the next press and on 'not this one'", async () => {
    await mountPlain();
    vi.useFakeTimers();
    try {
      await speakMatch(6, "heavy day");
      expect(offer()).not.toBeNull();
      // Trying again: they are speaking, the invitation has done its job.
      pointer("pointerdown", mic());
      expect(offer()).toBeNull();
      // The pending listen resolves with the new words before release.
      await act(async () => {
        micMock.resolve!({ transcript: "still heavy", index: 6, suggest: null, pattern: null, failure: null });
      });
      pointer("pointerup", mic());
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(offer()).not.toBeNull();
      await act(async () => {
        offer()!.querySelector<HTMLButtonElement>('[aria-label="Not this one"]')!.click();
      });
      expect(offer()).toBeNull();
      expect(container.querySelector(".is-suggested")).toBeNull(); // the glow retires with it
      expect(chosen).not.toContain(6); // dismissing never chooses
    } finally {
      vi.useRealTimers();
    }
  });

  it("a matched word tells the companion which feeling arrived", async () => {
    const states: Array<[string, number | undefined]> = [];
    await act(async () => {
      root.render(
        <PairedFeelings
          selectedIndex={null}
          onChoose={(i: number | null) => chosen.push(i)}
          onVoiceState={(st, i) => states.push([st, i])}
          showHint={false}
        />,
      );
    });
    vi.useFakeTimers();
    try {
      await speakMatch(6, "heavy day");
      expect(states).toContainEqual(["listening", undefined]);
      expect(states).toContainEqual(["matched", 6]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("before the first press, sets the permission-prompt expectation once", async () => {
    await mountPlain();
    const hint = container.querySelector(".brume-mic-hint");
    expect(hint?.textContent).toContain("hold to speak");
    expect(hint?.textContent).toContain("the browser asks for the mic the first time");
    micMock.listenOnce.mockResolvedValueOnce({
      transcript: "tense", index: 1, suggest: null, pattern: null, failure: null,
    });
    pointer("pointerdown", mic());
    pointer("pointerup", mic());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector(".brume-mic-hint")).toBeNull();
    expect(window.localStorage.getItem("brume.micUsed.v1")).toBe("1");
    // Next mount: the hint has said its one line.
    act(() => root.unmount());
    root = createRoot(container);
    await mountPlain();
    expect(container.querySelector(".brume-mic-hint")).toBeNull();
  });
});
