// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { E6_ARMS, e6Arm, isE6Arm } from "../arms";

beforeEach(() => window.localStorage.clear());

describe("e6Arm", () => {
  it("picks once and then reads it back, whatever the dice say", () => {
    const first = e6Arm(() => 0.5);
    expect(E6_ARMS).toContain(first);
    expect(e6Arm(() => 0)).toBe(first);
    expect(e6Arm(() => 0.99)).toBe(first);
  });

  it("covers every arm across the unit interval and never indexes out of range", () => {
    const seen = new Set<string>();
    for (const r of [0, 0.34, 0.67, 0.999999, 1]) {
      window.localStorage.clear();
      seen.add(e6Arm(() => r));
    }
    expect([...seen].sort()).toEqual([...E6_ARMS].sort());
  });

  it("ignores a stored value that is not on the list", () => {
    window.localStorage.setItem("brume/arm-e6", "a sentence someone typed");
    expect(isE6Arm(e6Arm(() => 0))).toBe(true);
    expect(window.localStorage.getItem("brume/arm-e6")).toBe("control");
  });

  it("is the control, and stores nothing, when storage refuses", () => {
    const spy = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("denied");
      },
    });
    try {
      expect(e6Arm(() => 0.99)).toBe("control");
    } finally {
      Object.defineProperty(window, "localStorage", spy);
    }
  });
});
