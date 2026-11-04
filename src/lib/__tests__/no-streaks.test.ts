/**
 * Brume has no streaks: not shown, not shared, not computed, not sent
 * to OneSignal. This guards the places they used to leak from.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no streaks", () => {
  const files = walk("src");
  // Copy that states the absence is fine; code that handles one is not.
  const allowed = new Set([join("src", "pages", "About.tsx")]);

  it("no source file computes, passes or sends a streak", () => {
    const hits = files
      .filter((f) => !allowed.has(f))
      .filter((f) => /streak/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("the OneSignal tag contract has no streak tag", () => {
    const src = readFileSync("src/lib/notifications/oneSignal.ts", "utf8");
    expect(src).not.toMatch(/streak/i);
  });
});
