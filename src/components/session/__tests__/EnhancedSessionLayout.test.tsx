/**
 * EnhancedSessionLayout — the session screen must fit the visible
 * viewport: controls belong above the browser's own bottom bar, which
 * means the dynamic viewport height (100dvh) and never a 100vh minimum.
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { EnhancedSessionLayout } from "../EnhancedSessionLayout";

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(EnhancedSessionLayout, {
        breathingAnimation: React.createElement("div", { "data-slot": "orb" }),
        controls: React.createElement("div", { "data-slot": "controls" }),
        onExit: () => {},
      }),
    );
  });
  return { container, root };
}

describe("EnhancedSessionLayout", () => {
  it("sizes to the dynamic viewport and never forces a 100vh minimum", () => {
    const { container, root } = render();
    const shell = container.firstElementChild as HTMLElement;
    // dvh when the browser supports it, h-screen as the fallback…
    expect(shell.className).toContain("supports-[height:100dvh]:h-[100dvh]");
    expect(shell.className).toContain("h-screen");
    // …and no min-h-screen: 100vh is the viewport WITH the URL bar
    // retracted, which pushes the controls behind the bar on mobile.
    expect(shell.className).not.toContain("min-h-screen");
    act(() => root.unmount());
    container.remove();
  });

  it("the controls seat keeps clear of the safe-area edge", () => {
    const { container, root } = render();
    const seat = container
      .querySelector('[data-slot="controls"]')!
      .parentElement as HTMLElement;
    expect(seat.className).toContain("env(safe-area-inset-bottom)");
    act(() => root.unmount());
    container.remove();
  });
});
