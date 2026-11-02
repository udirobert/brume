/**
 * Credential-loop smoke test — Brume's core differentiator journey.
 *
 * Covers: home → state check-in → session preview → progress.
 * There is no camera; this guards the loop skeleton
 * and the consolidation invariant (no links to buried surfaces).
 */
import { test, expect } from "@playwright/test";

test.describe("Brume core loop", () => {
  test("home renders Brume positioning and today's check-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Brume/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tap how you feel");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Brume picks the breath");
    await expect(page.getByText("What do you need today?")).toBeVisible();
    await expect(page.getByText("or pick a rhythm")).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("Progress");
    await expect(page.getByRole("banner")).not.toContainText("Practice");
  });

  test("check-in produces an evidence-cited recommendation", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.getByRole("button", { name: "Stressed" }).click();
    await expect(page).toHaveURL(/\/session/);
    await expect(page.getByText(/From how you feel/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Begin/ })).toBeVisible();

    expect(errors.filter((m) => m.includes("WagmiProvider") || m.includes("useConfig"))).toEqual([]);
  });

  test("session is chrome-less", async ({ page }) => {
    await page.goto("/session?pattern=box");
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("no dead links to buried surfaces", async ({ page }) => {
    await page.goto("/");
    const dead = page.locator(
      'a[href="/marketplace"], a[href="/lens"], a[href="/create"], a[href="/instructor-onboarding"], a[href="/community"], a[href="/help"]',
    );
    await expect(dead).toHaveCount(0);
  });

  test("progress page renders empty state or stats", async ({ page }) => {
    await page.goto("/progress");
    const empty = page.getByText("Nothing here yet.");
    const lived = page.getByRole("heading", { name: /Day |Your practice/ });
    await expect(empty.or(lived)).toBeVisible();
  });
});
