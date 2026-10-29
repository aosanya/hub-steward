import type { Block, FieldSpec } from "./types";

type JsonProperty = {
  type?: string;
  format?: string;
  enum?: unknown[];
  title?: string;
};

export type JsonSchema = {
  properties?: Record<string, JsonProperty>;
  required?: string[];
};

export function humanize(name: string): string {
  const words = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function kindOf(property: JsonProperty): FieldSpec["kind"] | null {
  const options = property.enum?.filter((value): value is string => typeof value === "string");
  if (property.type === "string" && options && options.length > 0) return "choice";
  if (property.type === "integer" || property.type === "number") return "number";
  if (property.type === "string") return property.format === "date" || property.format === "date-time" ? "date" : "text";
  return null;
}

export function fieldsFromSchema(schema: JsonSchema): FieldSpec[] {
  const required = new Set(schema.required ?? []);
  const fields: FieldSpec[] = [];
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const kind = kindOf(property);
    if (kind === null) continue;
    const field: FieldSpec = { name, label: property.title ?? humanize(name), kind };
    if (kind === "choice") field.options = property.enum?.filter((value): value is string => typeof value === "string");
    if (required.has(name)) field.required = true;
    fields.push(field);
  }
  return fields;
}

export function formFromSchema(tool: string, title: string, schema: JsonSchema, fixedArgs?: Record<string, unknown>, submitLabel = "Send"): Extract<Block, { kind: "form" }> {
  const fixed = fixedArgs ? Object.keys(fixedArgs) : [];
  const fields = fieldsFromSchema(schema).filter((field) => !fixed.includes(field.name));
  return { kind: "form", tool, title, fields, submitLabel, ...(fixedArgs ? { fixedArgs } : {}) };
}
