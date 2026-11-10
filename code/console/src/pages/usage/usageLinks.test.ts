import { describe, expect, it } from "vitest";
import { usagePages, usageSearch } from "./usageLinks";

describe("what a Usage page link carries from one Usage page to the next", () => {
  it("keeps the span, the group and the role on every Usage page", () => {
    for (const page of usagePages) {
      expect(usageSearch(`/h/h1/${page}`, "?span=7d&group=person&role=r1")).toBe("?span=7d&group=person&role=r1");
    }
  });

  it("drops what a Usage page does not carry", () => {
    expect(usageSearch("/h/h1/usage-work", "?span=today&open=x&add=1")).toBe("?span=today");
  });

  it("drops empty values", () => {
    expect(usageSearch("/h/h1/usage-agents", "?span=&role=r2")).toBe("?role=r2");
  });

  it("carries nothing from a page that is not a Usage page", () => {
    expect(usageSearch("/h/h1/users", "?span=7d")).toBe("");
    expect(usageSearch("/", "?span=7d")).toBe("");
  });

  it("gives an empty string when nothing is carried", () => {
    expect(usageSearch("/h/h1/usage", "")).toBe("");
  });
});
