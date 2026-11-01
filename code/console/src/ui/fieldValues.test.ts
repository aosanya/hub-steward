import { describe, expect, it } from "vitest";
import type { FieldSpec } from "../types";
import { currentValue, missingRequired, optionItems, submittedValues, toOptionItems } from "./fieldValues";

const spec = (over: Partial<FieldSpec> & Pick<FieldSpec, "name" | "component">): FieldSpec => over;

describe("option items", () => {
  it("turns plain words into value and label pairs and keeps explicit items", () => {
    expect(toOptionItems(["a", { value: "b", label: "Bee" }])).toEqual([
      { value: "a", label: "a" },
      { value: "b", label: "Bee" },
    ]);
  });

  it("is empty when there are no options", () => {
    expect(toOptionItems()).toEqual([]);
    expect(optionItems(spec({ name: "x", component: "select" }))).toEqual([]);
  });
});

describe("the value a field shows", () => {
  it.each([
    ["a toggle", spec({ name: "x", component: "toggle" }), false],
    ["radios", spec({ name: "x", component: "radios", options: ["a"] }), undefined],
    ["a select", spec({ name: "x", component: "select", options: ["first", "second"] }), "first"],
    ["a select with no options", spec({ name: "x", component: "select" }), ""],
    ["text", spec({ name: "x", component: "text" }), ""],
  ])("starts %s with its default", (_, field, expected) => {
    expect(currentValue(field, {})).toBe(expected);
  });

  it("keeps a typed value, including zero, false and the empty string", () => {
    const field = spec({ name: "x", component: "number" });
    expect(currentValue(field, { x: 0 })).toBe(0);
    expect(currentValue(field, { x: "" })).toBe("");
    expect(currentValue(spec({ name: "x", component: "toggle" }), { x: false })).toBe(false);
  });

  it("falls back to the default when the stored value is null", () => {
    expect(currentValue(spec({ name: "x", component: "select", options: ["a"] }), { x: null })).toBe("a");
  });
});

describe("the values a form submits", () => {
  const fields = [
    spec({ name: "title", component: "text" }),
    spec({ name: "kind", component: "select", options: ["one", "two"] }),
    spec({ name: "on", component: "toggle" }),
    spec({ name: "pick", component: "radios", options: ["a"] }),
    spec({ name: "upload", component: "file" }),
    spec({ name: "shown", component: "readonly" }),
    spec({ name: "locked", component: "text", readOnly: true }),
  ];

  it("includes defaults, leaves out unanswered radios, files, readonly and locked fields", () => {
    expect(submittedValues(fields, { upload: "x", shown: "y", locked: "z" })).toEqual({ title: "", kind: "one", on: false });
  });

  it("includes what was typed", () => {
    expect(submittedValues(fields, { title: "T", kind: "two", on: true, pick: "a" })).toEqual({ title: "T", kind: "two", on: true, pick: "a" });
  });
});

describe("required fields still missing", () => {
  it("lists blank required fields, treating whitespace as blank", () => {
    const fields = [
      spec({ name: "a", component: "text", required: true }),
      spec({ name: "b", component: "textarea", required: true }),
      spec({ name: "c", component: "text", required: true }),
      spec({ name: "d", component: "text" }),
    ];
    expect(missingRequired(fields, { a: "  ", b: "ok" })).toEqual(["a", "c"]);
  });

  it("accepts zero and false as answers", () => {
    const fields = [spec({ name: "n", component: "number", required: true }), spec({ name: "t", component: "toggle", required: true })];
    expect(missingRequired(fields, { n: 0, t: false })).toEqual([]);
  });

  it("asks for radios until one is picked", () => {
    const fields = [spec({ name: "r", component: "radios", required: true, options: ["a"] })];
    expect(missingRequired(fields, {})).toEqual(["r"]);
    expect(missingRequired(fields, { r: "a" })).toEqual([]);
  });

  it("counts a required select as answered by its first option, and an empty one as missing", () => {
    expect(missingRequired([spec({ name: "s", component: "select", required: true, options: ["a"] })], {})).toEqual([]);
    expect(missingRequired([spec({ name: "s", component: "select", required: true })], {})).toEqual(["s"]);
  });

  it("never asks for files, readonly or locked fields", () => {
    const fields = [
      spec({ name: "f", component: "file", required: true }),
      spec({ name: "r", component: "readonly", required: true }),
      spec({ name: "l", component: "text", required: true, readOnly: true }),
    ];
    expect(missingRequired(fields, {})).toEqual([]);
  });
});
