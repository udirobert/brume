import { describe, expect, it, vi } from "vitest";
import { viewTransitionTo } from "../viewTransition";

describe("viewTransitionTo", () => {
  it("navigates synchronously when the API is unsupported", () => {
    const go = vi.fn();
    viewTransitionTo(go, { start: null });
    expect(go).toHaveBeenCalledTimes(1);
  });

  it("runs the update once, inside the transition callback", () => {
    const holder: { cb: (() => void) | null } = { cb: null };
    const start = vi.fn((cb: () => void) => {
      holder.cb = cb;
      return { finished: Promise.resolve() };
    });
    const flush = vi.fn((cb: () => void) => cb());
    const go = vi.fn();

    viewTransitionTo(go, { start, flush });
    expect(start).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();

    holder.cb?.();
    expect(go).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(go);
  });

  it("still navigates if the browser rejects the transition before the update runs", () => {
    const start = vi.fn(() => {
      throw new Error("not allowed");
    });
    const go = vi.fn();
    viewTransitionTo(go, { start });
    expect(go).toHaveBeenCalledTimes(1);
  });

  it("never runs the update twice when the failure happens after it", () => {
    const start = vi.fn((cb: () => void) => {
      cb(); // update already ran, then the machinery throws
      throw new Error("late failure");
    });
    const go = vi.fn();
    viewTransitionTo(go, { start });
    expect(go).toHaveBeenCalledTimes(1);
  });
});
