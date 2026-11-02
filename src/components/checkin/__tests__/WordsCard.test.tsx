import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { WordsCard } from "../WordsCard";

describe("WordsCard", () => {
  it("renders the neutral opener with no check-in point", () => {
    const html = renderToString(<WordsCard checkInIndex={null} />);
    expect(html).toContain("I&#x27;m not sure how I am today.");
    expect(html).toContain("Your words");
    expect(html).toContain("Copy message");
  });

  it("renders the For row", () => {
    const html = renderToString(<WordsCard checkInIndex={2} />);
    expect(html).toContain("Someone close");
    expect(html).toContain("Work");
    expect(html).toContain("Just for me");
    expect(html).toContain("I&#x27;m carrying a lot today.");
  });
});
