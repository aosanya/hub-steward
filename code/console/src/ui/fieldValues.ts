import type { FieldSpec, OptionItem } from "../types";
import type { FormValues } from "./props";

export const toOptionItems = (options: (string | OptionItem)[] = []): OptionItem[] =>
  options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));

export const optionItems = (spec: FieldSpec): OptionItem[] => toOptionItems(spec.options);

const startsWith = (spec: FieldSpec): unknown => {
  switch (spec.component) {
    case "toggle":
      return false;
    case "radios":
      return undefined;
    case "select":
      return optionItems(spec)[0]?.value ?? "";
    default:
      return "";
  }
};

const notSubmitted = (spec: FieldSpec) => spec.component === "file" || spec.component === "readonly" || spec.readOnly === true;

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

export const currentValue = (spec: FieldSpec, values: FormValues): unknown => values[spec.name] ?? startsWith(spec);

export const submittedValues = (fields: FieldSpec[], values: FormValues): FormValues => {
  const submitted: FormValues = {};
  for (const spec of fields) {
    if (notSubmitted(spec)) continue;
    const value = currentValue(spec, values);
    if (value !== undefined) submitted[spec.name] = value;
  }
  return submitted;
};

export const missingRequired = (fields: FieldSpec[], values: FormValues): string[] =>
  fields.filter((spec) => spec.required && !notSubmitted(spec) && isBlank(currentValue(spec, values))).map((spec) => spec.name);
