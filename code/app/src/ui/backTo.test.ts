import { backState, backToOf } from "./backTo";

describe("backToOf", () => {
  it("reads a local path from the router state", () => {
    expect(backToOf({ backTo: "/started" }, "/my-orders")).toBe("/started");
    expect(backToOf({ backTo: "/coordinator/orders/g1?tab=2" }, "/my-orders")).toBe("/coordinator/orders/g1?tab=2");
  });

  it("falls back when there is no state, no backTo or nothing usable", () => {
    expect(backToOf(null, "/my-orders")).toBe("/my-orders");
    expect(backToOf(undefined, "/my-orders")).toBe("/my-orders");
    expect(backToOf({}, "/my-orders")).toBe("/my-orders");
    expect(backToOf({ backTo: "" }, "/my-orders")).toBe("/my-orders");
    expect(backToOf({ backTo: 42 }, "/my-orders")).toBe("/my-orders");
    expect(backToOf("/started", "/my-orders")).toBe("/my-orders");
  });

  it("ignores anything that is not a path on this app", () => {
    expect(backToOf({ backTo: "https://x" }, "/my-orders")).toBe("/my-orders");
    expect(backToOf({ backTo: "started" }, "/my-orders")).toBe("/my-orders");
    expect(backToOf({ backTo: "//x.test/started" }, "/my-orders")).toBe("/my-orders");
    expect(backToOf({ backTo: "/\\x.test" }, "/my-orders")).toBe("/my-orders");
  });

  it("is what backState builds for a navigate call", () => {
    const { state } = backState("/started");
    expect(state).toEqual({ backTo: "/started" });
    expect(backToOf(state, "/")).toBe("/started");
  });
});
