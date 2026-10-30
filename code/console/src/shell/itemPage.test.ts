import { describe, expect, it } from "vitest";
import { itemPageOf } from "./labels";

describe("the page a tab is named for", () => {
  it("is the single item when one objective or goal is open, and the page otherwise", () => {
    expect(itemPageOf("objectives", "?objective=o1")).toBe("objective");
    expect(itemPageOf("goals", "?goal=g1")).toBe("goal");
    expect(itemPageOf("objectives", "")).toBe("objectives");
    expect(itemPageOf("objectives", "?add=objective")).toBe("objectives");
    expect(itemPageOf("roles", "?objective=o1")).toBe("roles");
  });
});
