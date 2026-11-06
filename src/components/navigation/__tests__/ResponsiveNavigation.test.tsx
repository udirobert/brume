// @vitest-environment jsdom
/**
 * One navigation, everywhere on a phone. Decompress used to live outside
 * MainLayout with a chip of its own, so going there dropped the tab bar and
 * the way back — the one route where the nav stopped being the nav.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const mobile = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStatus: () => ({ isAuthenticated: false, isLoading: false }),
}));
vi.mock("@/components/atmosphere/ProgressiveBlur", () => ({ ProgressiveBlur: () => null }));

import { ResponsiveNavigation } from "../ResponsiveNavigation";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mountAt = async (path: string) => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <ResponsiveNavigation>
          <div data-page />
        </ResponsiveNavigation>
      </MemoryRouter>,
    );
  });
};

const tabBar = () => container.querySelector("nav.fixed.bottom-0");

describe("ResponsiveNavigation on a phone", () => {
  it.each(["/", "/progress", "/decompress"])("%s has the header and the tab bar", async (path) => {
    await mountAt(path);
    expect(container.querySelector("header")).not.toBeNull();
    expect(tabBar()).not.toBeNull();
  });

  it("marks Decompress as the current tab on /decompress", async () => {
    await mountAt("/decompress");
    const labels = [...tabBar()!.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toEqual(["Home", "Progress", "Decompress", "Sign in"]);
  });

  it("lets Decompress fill the screen instead of centring it in a padded box", async () => {
    await mountAt("/decompress");
    const main = container.querySelector("main")!;
    expect(main.className).not.toMatch(/\bp-4\b|justify-center/);
    expect(main.className).toMatch(/pb-20/);
  });

  it("still gives sessions the whole screen", async () => {
    await mountAt("/session");
    expect(container.querySelector("header")).toBeNull();
    expect(tabBar()).toBeNull();
  });
});
