import { describe, expect, it } from "vitest";
import { controlsHref } from "./controlsLinks";

describe("the controls page's addresses", () => {
  it("opens the list with no target", () => {
    expect(controlsHref("h1")).toBe("/h/h1/controls");
  });

  it("opens the add form", () => {
    expect(controlsHref("h1", { add: true })).toBe("/h/h1/controls?add=control");
  });

  it("opens one control, its id encoded", () => {
    expect(controlsHref("h1", { control: "c 1/2" })).toBe("/h/h1/controls?control=c%201%2F2");
  });

  it("prefers the add form when both are asked for", () => {
    expect(controlsHref("h1", { add: true, control: "c1" })).toBe("/h/h1/controls?add=control");
  });
});
