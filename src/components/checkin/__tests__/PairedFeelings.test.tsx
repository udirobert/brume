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
let chosen: number[];

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
