import { describe, it, expect } from "vitest";
import { formatPracticeDuration } from "../practice-duration";

describe("formatPracticeDuration", () => {
  it.each<[number, string]>([
    [0, "0s"],
    [45, "45s"],
    [59.6, "1m"],
    [60, "1m"],
    [90, "1m 30s"],
    [119.6, "2m"],
    [300, "5m"],
    [-5, "0s"],
    [NaN, "0s"],
    [Infinity, "0s"],
  ])("%s -> %s", (input, expected) => {
    expect(formatPracticeDuration(input)).toBe(expected);
  });
});
