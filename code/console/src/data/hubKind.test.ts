import { describe, expect, it } from "vitest";
import { kindOf, stateOf } from "./hubKind";

describe("the kind of a hub is the template it was made from", () => {
  it.each([
    ["farmers' group", "farmers"],
    ["community computer lab", "lab"],
    ["Lab", "lab"],
    ["boda boda riders' group", "riders"],
    ["Farmers' Group", "farmers"],
    ["riders", "riders"],
  ])("reads %s as %s", (kind, expected) => {
    expect(kindOf({ kind })).toBe(expected);
  });

  it.each(["research advisory practice", "design collaboration studio", "labour union", "university", ""])('reads "%s" as another kind', (kind) => {
    expect(kindOf({ kind })).toBe("other");
  });

  it("reads a hub for which wakala names no kind as another kind", () => {
    expect(kindOf({})).toBe("other");
  });
});

describe("the state of a hub follows its model key", () => {
  it("is ready once a model key is saved", () => {
    expect(stateOf({ model_key_set: true })).toBe("ready");
  });

  it("is setting up while the key is missing or not yet known", () => {
    expect(stateOf({ model_key_set: false })).toBe("setup");
    expect(stateOf({})).toBe("setup");
  });
});
