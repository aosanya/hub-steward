import { describe, expect, it } from "vitest";
import type { FieldSpec } from "../types";
import { SchemaError, fieldsFromSchema, missingFields } from "./schemaForm";

const fieldNamed = (fields: FieldSpec[], name: string): FieldSpec => {
  const found = fields.find((field) => field.name === name);
  if (!found) throw new Error(`no field ${name}`);
  return found;
};

describe("turning a schema into fields", () => {
  const schema = {
    required: ["key"],
    properties: {
      key: { type: "string", format: "password" },
      mode: { type: "string", enum: ["a", "b"] },
      region: { type: "string", enum: ["a", "b", "c", "d", "e"] },
      on: { type: "boolean" },
      count: { type: "integer" },
      day: { type: "string", format: "date" },
      tags: { type: "array", items: { type: "string" } },
      note: { type: "string", maxLength: 500 },
      name: { type: "string" },
      file: { type: "string", format: "binary" },
      id: { type: "string", readOnly: true },
    },
  };

  it("gives each property the component that suits its type, format, choices and length", () => {
    const fields = fieldsFromSchema(schema);
    const expected = {
      key: "secret",
      mode: "radios",
      region: "select",
      on: "toggle",
      count: "number",
      day: "date",
      tags: "chips",
      note: "textarea",
      name: "text",
      file: "file",
      id: "readonly",
    };

    for (const [name, component] of Object.entries(expected)) expect(fieldNamed(fields, name).component, name).toBe(component);
  });

  it("puts the required field first when the schema lists it first", () => {
    const first = fieldsFromSchema(schema)[0];

    expect(first.name).toBe("key");
    expect(first.required).toBe(true);
  });

  it("keeps the order of the properties as the schema writes them", () => {
    const fields = fieldsFromSchema({
      required: ["zeta"],
      properties: { mid: { type: "string" }, zeta: { type: "string" }, alpha: { type: "string" } },
    });

    expect(fields.map((field) => field.name)).toEqual(["mid", "zeta", "alpha"]);
  });

  it("marks only the properties named in required as required", () => {
    const fields = fieldsFromSchema({ required: ["a"], properties: { a: { type: "string" }, b: { type: "string" } } });

    expect(fields.map((field) => field.required)).toEqual([true, false]);
  });

  it("offers up to four choices as radio buttons and more than four as a select", () => {
    const four = fieldsFromSchema({ properties: { p: { enum: ["a", "b", "c", "d"] } } })[0];
    const five = fieldsFromSchema({ properties: { p: { enum: ["a", "b", "c", "d", "e"] } } })[0];

    expect([four.component, five.component]).toEqual(["radios", "select"]);
    expect(five.options).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("lists the choices only for a property that has some", () => {
    const fields = fieldsFromSchema({ properties: { plain: { type: "string" }, pick: { enum: ["a"] } } });

    expect(fields[0]).not.toHaveProperty("options");
    expect(fields[1].options).toEqual(["a"]);
  });

  it("marks a read only property as read only and shows it as read only even when it has choices", () => {
    const field = fieldsFromSchema({ properties: { id: { type: "string", readOnly: true, enum: ["a", "b"] } } })[0];

    expect(field).toMatchObject({ component: "readonly", readOnly: true });
  });

  it("leaves readOnly off a property that is not read only", () => {
    expect(fieldsFromSchema({ properties: { a: { type: "string" } } })[0]).not.toHaveProperty("readOnly");
  });

  it("treats the secret format like the password format", () => {
    expect(fieldsFromSchema({ properties: { a: { type: "string", format: "secret" } } })[0].component).toBe("secret");
  });

  it("asks for a long text from 200 characters and a plain text below", () => {
    const fields = fieldsFromSchema({ properties: { short: { maxLength: 199 }, long: { maxLength: 200 }, area: { format: "textarea" } } });

    expect(fields.map((field) => field.component)).toEqual(["text", "textarea", "textarea"]);
  });

  it("shows a number for the number type as well as the integer type", () => {
    expect(fieldsFromSchema({ properties: { a: { type: "number" } } })[0].component).toBe("number");
  });

  it("gives a choice priority over the type", () => {
    expect(fieldsFromSchema({ properties: { a: { type: "boolean", enum: ["x", "y"] } } })[0].component).toBe("radios");
  });

  it("gives no fields for a schema without properties or without anything at all", () => {
    expect(fieldsFromSchema({})).toEqual([]);
    expect(fieldsFromSchema(null)).toEqual([]);
    expect(fieldsFromSchema({ properties: null })).toEqual([]);
  });

  it("shows a property declared as null as a plain text", () => {
    expect(fieldsFromSchema({ properties: { a: null } })).toEqual([{ name: "a", component: "text", required: false }]);
  });

  it("refuses a schema that is not an object", () => {
    for (const bad of [[], "text", 7, true]) expect(() => fieldsFromSchema(bad)).toThrow(SchemaError);
  });

  it("refuses properties that are not an object and a property that is not an object", () => {
    expect(() => fieldsFromSchema({ properties: [] })).toThrow(SchemaError);
    expect(() => fieldsFromSchema({ properties: { a: "text" } })).toThrow(SchemaError);
  });

  it("refuses a required list, a choice list, a type, a length or a read only flag of the wrong kind", () => {
    const wrong = [
      { required: "a", properties: {} },
      { properties: { a: { enum: "x" } } },
      { properties: { a: { enum: [1, 2] } } },
      { properties: { a: { type: 5 } } },
      { properties: { a: { format: false } } },
      { properties: { a: { maxLength: "5" } } },
      { properties: { a: { maxLength: 5.5 } } },
      { properties: { a: { readOnly: "yes" } } },
      { properties: { a: { items: "text" } } },
    ];

    for (const schema of wrong) expect(() => fieldsFromSchema(schema), JSON.stringify(schema)).toThrow(SchemaError);
  });
});

describe("naming the required fields a form left blank", () => {
  const schema = {
    required: ["a", "b", "c"],
    properties: { a: { type: "string" }, b: { type: "string" }, c: { type: "boolean" }, d: { type: "string" } },
  };

  it("names a required field that is blank or absent, in the order of the schema", () => {
    expect(missingFields(schema, { a: "  ", c: false })).toEqual(["a", "b"]);
  });

  it("counts an unticked switch, a zero and a filled text as filled in", () => {
    expect(missingFields(schema, { a: "x", b: "y", c: false })).toEqual([]);
    expect(missingFields({ required: ["n"], properties: { n: { type: "integer" } } }, { n: 0 })).toEqual([]);
  });

  it("names a required field whose value is null or undefined", () => {
    expect(missingFields(schema, { a: null, b: undefined, c: true })).toEqual(["a", "b"]);
  });

  it("does not name a field that is not required", () => {
    expect(missingFields(schema, { a: "x", b: "y", c: true, d: "" })).toEqual([]);
  });

  it("does not name a required read only field", () => {
    expect(missingFields({ required: ["id"], properties: { id: { type: "string", readOnly: true } } }, {})).toEqual([]);
  });

  it("names nothing for a schema that requires nothing", () => {
    expect(missingFields({ properties: { a: { type: "string" } } }, {})).toEqual([]);
  });

  it("refuses a schema that is not valid", () => {
    expect(() => missingFields([], {})).toThrow(SchemaError);
  });
});
