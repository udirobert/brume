/**
 * Tailwind theme seam — the legacy JS config loaded via @config must still
 * carry the mist palette and animation plugin declarations.
 */
import { describe, it, expect } from "vitest";
import config from "../../tailwind.config";

describe("tailwind config (v4 @config seam)", () => {
  it("keeps the brume mist palette", () => {
    const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    const brume = colors.brume as Record<string, string>;
    expect(brume["500"]).toBe("#547a90");
    expect(brume["950"]).toBe("#151f28");
    expect(colors.primary).toEqual(
      expect.objectContaining({ DEFAULT: "hsl(var(--primary))" }),
    );
  });

  it("keeps class dark mode and animation plugins", () => {
    expect(config.darkMode).toBe("class");
    expect(config.plugins?.length).toBe(2);
    const animation = config.theme?.extend?.animation as Record<string, string>;
    expect(animation["breathe"]).toContain("breathe");
    expect(animation["accordion-down"]).toContain("accordion-down");
  });
});
