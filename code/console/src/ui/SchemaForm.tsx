import { useMemo } from "react";
import { fieldsFromSchema, missingFields } from "../data/schemaForm";
import { useI18n } from "../i18n";
import type { FieldSpec } from "../types";
import { Empty } from "./Empty";
import { FormObject } from "./FormObject";
import type { FormValues, SchemaFormProps } from "./props";

const readFields = (schema: object): FieldSpec[] | null => {
  try {
    return fieldsFromSchema(schema);
  } catch {
    return null;
  }
};

export function SchemaForm({ schema, choices = {}, onSubmit, ...form }: SchemaFormProps) {
  const { t } = useI18n();
  const schemaKey = JSON.stringify(schema);
  const choicesKey = JSON.stringify(choices);
  const fields = useMemo(
    () =>
      readFields(schema)?.map((field) =>
        Object.hasOwn(choices, field.name) ? { ...field, component: "select" as const, options: choices[field.name] } : field,
      ) ?? null,
    [schemaKey, choicesKey],
  );

  const submit = async (values: FormValues) => {
    const missing = missingFields(schema, values);
    if (missing.length > 0) return `${t("required")}: ${missing.join(", ")}`;
    return onSubmit(values);
  };

  if (fields === null) return <Empty text={t("loadFailed")} failed />;
  return <FormObject {...form} fields={fields} onSubmit={submit} />;
}
