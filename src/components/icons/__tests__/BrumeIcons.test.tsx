import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  HomeIcon,
  ProgressIcon,
  DecompressIcon,
  ProfileIcon,
  ResetIcon,
} from "../BrumeIcons";

const icons = { HomeIcon, ProgressIcon, DecompressIcon, ProfileIcon, ResetIcon };

describe("BrumeIcons", () => {
  for (const [name, Icon] of Object.entries(icons)) {
    it(`${name} renders a stroked, hidden SVG`, () => {
      const html = renderToString(<Icon />);
      expect(html).toContain("<svg");
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('stroke="currentColor"');
      expect(html).toContain('viewBox="0 0 24 24"');
    });
  }
});
