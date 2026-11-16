import { describe, expect, it } from "vitest";
import { formatSize } from "./formatSize";

describe("format size", () => {
  it("writes bytes whole", () => {
    expect(formatSize(12)).toBe("12 B");
    expect(formatSize(0)).toBe("0 B");
  });

  it("writes kilobytes with one decimal", () => {
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(1024)).toBe("1 KB");
  });

  it("drops a trailing zero decimal", () => {
    expect(formatSize(2097152)).toBe("2 MB");
  });

  it("writes gigabytes", () => {
    expect(formatSize(3 * 1024 * 1024 * 1024)).toBe("3 GB");
  });
});
