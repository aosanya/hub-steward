import { describe, expect, it } from "vitest";
import { fieldsFromSchema, formFromSchema, humanize } from "./schema";

describe("a field name made readable", () => {
  it.each([
    ["unit_price", "Unit price"],
    ["unit-price", "Unit price"],
    ["unitPrice", "Unit price"],
    ["kg", "Kg"],
    ["GPS_code", "GPS code"],
    ["__x__", "X"],
    ["", ""],
    ["a1B", "A1 B"],
  ])("%j becomes %j", (name, label) => expect(humanize(name)).toBe(label));
});

describe("fields from a tool's input schema", () => {
  it("makes a text, number, date and choice field in schema order", () => {
    expect(
      fieldsFromSchema({
        properties: {
          note: { type: "string" },
          qty: { type: "integer" },
          price: { type: "number" },
          due: { type: "string", format: "date" },
          at: { type: "string", format: "date-time" },
          grade: { type: "string", enum: ["A", "B"] },
        },
        required: ["qty"],
      }),
    ).toEqual([
      { name: "note", label: "Note", kind: "text" },
      { name: "qty", label: "Qty", kind: "number", required: true },
      { name: "price", label: "Price", kind: "number" },
      { name: "due", label: "Due", kind: "date" },
      { name: "at", label: "At", kind: "date" },
      { name: "grade", label: "Grade", kind: "choice", options: ["A", "B"] },
    ]);
  });

  it("skips booleans, arrays and objects it cannot draw", () => {
    expect(fieldsFromSchema({ properties: { a: { type: "boolean" }, b: { type: "array" }, c: { type: "object" }, d: {} } })).toEqual([]);
  });

  it("prefers the schema's title for the label", () => {
    expect(fieldsFromSchema({ properties: { x: { type: "string", title: "Your name" } } })[0].label).toBe("Your name");
  });

  it("draws an enum with no strings as plain text", () => {
    expect(fieldsFromSchema({ properties: { x: { type: "string", enum: [1, 2] } } })[0]).toEqual({ name: "x", label: "X", kind: "text" });
  });

  it("drops non-string options from a mixed enum", () => {
    expect(fieldsFromSchema({ properties: { x: { type: "string", enum: ["a", 2, "b"] } } })[0].options).toEqual(["a", "b"]);
  });

  it("gives no fields for an empty schema", () => {
    expect(fieldsFromSchema({})).toEqual([]);
  });

  it("does not mark a field required that the schema does not list", () => {
    expect(fieldsFromSchema({ properties: { x: { type: "string" } }, required: ["y"] })[0].required).toBeUndefined();
  });
});

describe("a form from a tool", () => {
  const schema = { properties: { order_id: { type: "string" }, note: { type: "string" } }, required: ["order_id"] };

  it("hides the fields the caller fixes and carries them along", () => {
    const form = formFromSchema("market_cancel_order", "Cancel", schema, { order_id: "o1" });
    expect(form.fields.map((f) => f.name)).toEqual(["note"]);
    expect(form.fixedArgs).toEqual({ order_id: "o1" });
    expect(form.submitLabel).toBe("Send");
  });

  it("has no fixedArgs key when nothing is fixed", () => {
    expect("fixedArgs" in formFromSchema("t", "T", schema)).toBe(false);
  });

  it("takes the submit label it is given", () => {
    expect(formFromSchema("t", "T", schema, undefined, "Cancel order").submitLabel).toBe("Cancel order");
  });
});
