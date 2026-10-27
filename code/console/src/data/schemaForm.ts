import type { FieldComponent, FieldSpec } from "../types";

export class SchemaError extends Error {}

type Prop = {
  type: string;
  format: string;
  enum: string[];
  maxLength: number;
  readOnly: boolean;
};

type Shape = Record<string, unknown>;

const radioLimit = 4;
const textareaFrom = 200;

const isShape = (value: unknown): value is Shape => typeof value === "object" && value !== null && !Array.isArray(value);

const shapeOrNone = (value: unknown, what: string): Shape => {
  if (value === undefined || value === null) return {};
  if (!isShape(value)) throw new SchemaError(`${what} must be an object`);
  return value;
};

const textOr = (value: unknown, fallback: string, what: string): string => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new SchemaError(`${what} must be a string`);
  return value;
};

const textsOrNone = (value: unknown, what: string): string[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new SchemaError(`${what} must be a list of strings`);
  return value;
};

const wholeNumberOr = (value: unknown, fallback: number, what: string): number => {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value)) throw new SchemaError(`${what} must be a whole number`);
  return value as number;
};

const flagOr = (value: unknown, what: string): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") throw new SchemaError(`${what} must be true or false`);
  return value;
};

function propOf(raw: unknown, name: string): Prop {
  const shape = shapeOrNone(raw, name);
  if (shape.items !== undefined) propOf(shape.items, `${name}.items`);
  return {
    type: textOr(shape.type, "", `${name}.type`),
    format: textOr(shape.format, "", `${name}.format`),
    enum: textsOrNone(shape.enum, `${name}.enum`),
    maxLength: wholeNumberOr(shape.maxLength, 0, `${name}.maxLength`),
    readOnly: flagOr(shape.readOnly, `${name}.readOnly`),
  };
}

function componentFor(prop: Prop): FieldComponent {
  if (prop.readOnly) return "readonly";
  if (prop.enum.length > 0) return prop.enum.length <= radioLimit ? "radios" : "select";
  if (prop.type === "boolean") return "toggle";
  if (prop.type === "integer" || prop.type === "number") return "number";
  if (prop.type === "array") return "chips";
  if (prop.format === "password" || prop.format === "secret") return "secret";
  if (prop.format === "date") return "date";
  if (prop.format === "binary") return "file";
  if (prop.format === "textarea") return "textarea";
  if (prop.maxLength >= textareaFrom) return "textarea";
  return "text";
}

function fieldOf(name: string, prop: Prop, required: Set<string>): FieldSpec {
  const field: FieldSpec = { name, component: componentFor(prop), required: required.has(name) };
  if (prop.enum.length > 0) field.options = prop.enum;
  if (prop.readOnly) field.readOnly = true;
  return field;
}

export function fieldsFromSchema(schema: unknown): FieldSpec[] {
  const top = shapeOrNone(schema, "the schema");
  const required = new Set(textsOrNone(top.required, "required"));
  const properties = shapeOrNone(top.properties, "properties");
  return Object.entries(properties).map(([name, raw]) => fieldOf(name, propOf(raw, name), required));
}

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

export function missingFields(schema: unknown, values: Record<string, unknown>): string[] {
  return fieldsFromSchema(schema)
    .filter((field) => field.required && !field.readOnly && isBlank(values[field.name]))
    .map((field) => field.name);
}
