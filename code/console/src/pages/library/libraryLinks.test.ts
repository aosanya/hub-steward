import { describe, expect, it } from "vitest";
import { libraryHref } from "./libraryLinks";

describe("the address of a library page", () => {
  it("is the kind's page with nothing asked", () => {
    expect(libraryHref("h1", "hazard")).toBe("/h/h1/hazards");
    expect(libraryHref("h1", "threat")).toBe("/h/h1/threats");
    expect(libraryHref("h1", "consequence")).toBe("/h/h1/consequences");
  });

  it("opens the add form", () => {
    expect(libraryHref("h1", "threat", { add: true })).toBe("/h/h1/threats?add=1");
  });

  it("opens one row and names a hazard to start from", () => {
    expect(libraryHref("h1", "hazard", { open: "q 1", hazard: "h2" })).toBe("/h/h1/hazards?open=q+1&hazard=h2");
  });

  it("encodes the hub id", () => {
    expect(libraryHref("a/b", "hazard")).toBe("/h/a%2Fb/hazards");
  });
});
