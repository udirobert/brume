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
      // Second press ends the tap-mode listen.
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
});
