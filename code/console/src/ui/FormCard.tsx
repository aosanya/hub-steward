import { useState } from "react";
import { useI18n } from "../i18n";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { FormCardField, FormCardProps, FormCardValues } from "./props";
import { MsgCard } from "./chat/MsgCard";
import { Toggle } from "./Toggle";

const nameOf = (field: FormCardField) => field.name ?? field.label;

const startValues = (fields: FormCardField[]): FormCardValues =>
  Object.fromEntries(fields.map((field) => [nameOf(field), field.value ?? (field.kind === "toggle" ? false : field.kind === "select" ? (field.options?.[0] ?? "") : "")]));

type ControlProps = { field: FormCardField; value: string | boolean; onChange: (value: string | boolean) => void };

function FormCardControl({ field, value, onChange }: ControlProps) {
  const text = String(value);
  if (field.kind === "toggle") return <Toggle label={field.label} on={value === true} onChange={onChange} />;
  const control =
    field.kind === "select" ? (
      <span className="control">
        <select aria-label={field.label} value={text} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? [text]).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={16} />
      </span>
    ) : field.kind === "textarea" ? (
      <span className="control">
        <textarea aria-label={field.label} placeholder={field.placeholder} value={text} onChange={(e) => onChange(e.target.value)} />
      </span>
    ) : (
      <span className="control">
        <input type="text" aria-label={field.label} placeholder={field.placeholder} value={text} onChange={(e) => onChange(e.target.value)} />
      </span>
    );
  return (
    <div className="field">
      <span className="field-label">{field.label}</span>
      {control}
      {field.hint ? <span className="hint">{field.hint}</span> : null}
    </div>
  );
}

export function FormCard({ title, fields, submit, cancel, hint, onSubmit, onCancel }: FormCardProps) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => startValues(fields));
  const submitLabel = submit ?? t("save");
  return (
    <MsgCard
      icon="edit"
      title={title ?? ""}
      heading={Boolean(title)}
      footer={[
        <Button key="submit" size="sm" onClick={() => onSubmit?.(values)}>
          {submitLabel}
        </Button>,
        <Button key="cancel" kind="quiet" size="sm" onClick={onCancel}>
          {cancel ?? t("cancel")}
        </Button>,
      ]}
    >
      <div className="msg-form">
        {fields.map((field) => (
          <FormCardControl
            key={nameOf(field)}
            field={field}
            value={values[nameOf(field)]}
            onChange={(value) => setValues({ ...values, [nameOf(field)]: value })}
          />
        ))}
      </div>
      <div className="msg-note">{hint ?? t("ui.nothingUntilPress").replace("{action}", submitLabel)}</div>
    </MsgCard>
  );
}
