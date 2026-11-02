// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { RouteErrorFallback } from "../RouteErrorBoundary";

describe("RouteErrorFallback", () => {
  it("shows the sleepy mascot and calm copy", () => {
    const html = renderToString(<RouteErrorFallback retry={() => {}} />);
    expect(html).toContain("Something slipped.");
    expect(html).toContain("Try again");
    expect(html).toContain("brume-mascot");
    expect(html).not.toContain("!");
  });
});
