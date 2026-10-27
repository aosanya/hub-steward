import { useEffect, useState } from "react";
import { toolSchema } from "../../data/actionSchema";
import { useI18n } from "../../i18n";
import type { FieldSpec, OptionItem } from "../../types";
import { Empty, FormObject, SchemaForm, type FormValues } from "../../ui";
import { actionForms, type ActionForm, type ActionFormId } from "./actionForms";
import { pickerOptions } from "./pickerOptions";
import { sendAction, type Outcome } from "./sendAction";

type ActionSlotProps = {
  formId: ActionFormId;
  title: string;
  hubId: string;
  onOutcome: (result: Outcome) => void;
  onClose: () => void;
};

type Drawn =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "fields"; fields: FieldSpec[] }
  | { kind: "schema"; schema: object; choices: Record<string, (string | OptionItem)[]> };

const withPickedOptions = (fields: FieldSpec[], hubId: string) =>
  Promise.all(
    fields.map(async (field) =>
      field.optionsFrom ? { ...field, options: await pickerOptions(field.optionsFrom, hubId) } : field,
    ),
  );

const choicesOf = async (form: ActionForm, hubId: string) => {
  const picked = await Promise.all(
    Object.entries(form.pickers ?? {}).map(async ([name, source]) => [name, await pickerOptions(source, hubId)] as const),
  );
  return { ...form.choices, ...Object.fromEntries(picked) };
};

const draw = async (form: ActionForm, hubId: string): Promise<Drawn> => {
  if (!form.drawing) return { kind: "fields", fields: await withPickedOptions(form.fields ?? [], hubId) };
  try {
    const [schema, choices] = await Promise.all([toolSchema(form.drawing), choicesOf(form, hubId)]);
    return { kind: "schema", schema, choices };
  } catch {
    return { kind: "failed" };
  }
};

export function ActionSlot({ formId, title, hubId, onOutcome, onClose }: ActionSlotProps) {
  const { t } = useI18n();
  const form = actionForms[formId];
  const [drawn, setDrawn] = useState<Drawn>({ kind: "loading" });

  useEffect(() => {
    let current = true;
    draw(form, hubId).then((result) => {
      if (current) setDrawn(result);
    });
    return () => {
      current = false;
    };
  }, [form, hubId]);

  if (drawn.kind === "loading") return null;
  if (drawn.kind === "failed") return <Empty text={t("loadFailed")} failed />;

  const submit = async (values: FormValues) => {
    const result = await sendAction(form.page, form.action, hubId, values);
    onOutcome(result);
    if (result !== "failed") onClose();
  };

  if (drawn.kind === "schema") {
    return <SchemaForm title={title} schema={drawn.schema} choices={drawn.choices} onSubmit={submit} onCancel={onClose} />;
  }
  return <FormObject title={title} fields={drawn.fields} onSubmit={submit} onCancel={onClose} />;
}
