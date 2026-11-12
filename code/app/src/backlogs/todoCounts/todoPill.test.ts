import { describe, expect, it } from "vitest";
import { todoCountsOf, todoPillOf } from "./todoPill";

describe("the pill is Done pieces over all pieces", () => {
  it("reads 2 of 6", () => {
    expect(todoPillOf({ done: 2, total: 6 })).toEqual({ label: "2 of 6", title: "2 of 6 todos done" });
  });

  it("reads 0 of 3 and 3 of 3", () => {
    expect(todoPillOf({ done: 0, total: 3 })?.label).toBe("0 of 3");
    expect(todoPillOf({ done: 3, total: 3 })?.label).toBe("3 of 3");
  });

  it("reads 1 of 1 in the singular title", () => {
    expect(todoPillOf({ done: 1, total: 1 })).toEqual({ label: "1 of 1", title: "1 of 1 todo done" });
  });

  it("shows nothing without todos", () => {
    expect(todoPillOf(undefined)).toBeNull();
    expect(todoPillOf({ done: 0, total: 0 })).toBeNull();
  });

  it("shows nothing for a count that cannot be right", () => {
    expect(todoPillOf({ done: 7, total: 6 })).toBeNull();
    expect(todoPillOf({ done: -1, total: 6 })).toBeNull();
    expect(todoPillOf({ done: 1.5, total: 6 })).toBeNull();
  });
});

describe("the counts read is turned into counts by issue", () => {
  it("keeps well-formed entries and drops the rest", () => {
    expect(todoCountsOf({ a: { done: 2, total: 6 }, b: { done: "x", total: 3 }, c: null, d: { done: 0, total: 0 } })).toEqual({ a: { done: 2, total: 6 } });
  });

  it("gives nothing for a reply that is not a map", () => {
    expect(todoCountsOf(null)).toEqual({});
    expect(todoCountsOf("x")).toEqual({});
    expect(todoCountsOf([1])).toEqual({});
  });
});
