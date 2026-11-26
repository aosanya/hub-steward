import { describe, expect, it } from "vitest";
import { kindOf, namedKindOf, stateOf } from "./hubKind";

describe("the kind of a hub is the template it was made from", () => {
  it.each([
    ["farmers' group", "farmers"],
    ["community computer lab", "lab"],
    ["boda boda riders' group", "riders"],
    ["Farmers' Group", "farmers"],
    ["riders", "riders"],
  ])("reads %s as %s", (kind, expected) => {
    expect(kindOf({ kind })).toBe(expected);
  });

  it("falls back to a lab when wakala names no kind or one the console does not know", () => {
    expect(kindOf({})).toBe("lab");
    expect(kindOf({ kind: "" })).toBe("lab");
    expect(kindOf({ kind: "university" })).toBe("lab");
  });
});

describe("the kind a person is shown is only one the console knows", () => {
  it.each([
    ["community computer lab", "lab"],
    ["Lab", "lab"],
    ["farmers' group", "farmers"],
    ["boda boda riders' group", "riders"],
  ])("names %s as %s", (kind, expected) => {
    expect(namedKindOf({ kind })).toBe(expected);
  });

  it.each(["research advisory practice", "design collaboration studio", "labour union", "university", ""])('names no kind for "%s"', (kind) => {
    expect(namedKindOf({ kind })).toBeNull();
  });

  it("names no kind when wakala sends none", () => {
    expect(namedKindOf({})).toBeNull();
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
