import { useId, type FormEvent, type ReactNode } from "react";
import type { OptionItem } from "../../types";
import { Button, Icon, Labelled } from "../../ui";
import { MsgCard } from "../../ui/chat/MsgCard";

type FormCardProps = {
  title: string;
  submit: string;
  cancel: string;
  note: string;
  error?: string;
  busy?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children: ReactNode;
};

export function FormCard({ title, submit, cancel, note, error, busy, onSubmit, onCancel, children }: FormCardProps) {
  const send = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form aria-label={title} noValidate onSubmit={send}>
      <MsgCard
        icon="edit"
        title={title}
        footer={[
          <Button key="submit" type="submit" size="sm" disabled={busy}>
            {submit}
          </Button>,
          <Button key="cancel" kind="quiet" size="sm" onClick={onCancel}>
            {cancel}
          </Button>,
        ]}
      >
        <div className="msg-form">{children}</div>
        {error ? (
          <div className="field-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="msg-note">{note}</div>
      </MsgCard>
    </form>
  );
}

type FieldProps = { label: string; hint?: string; children: (id: string) => ReactNode };

function FormField({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <Labelled id={id} label={label} hint={hint} required={false}>
      {children(id)}
    </Labelled>
  );
}

type TextFieldProps = { label: string; value: string; onChange: (value: string) => void; placeholder?: string; hint?: string };

export function FormText({ label, value, onChange, placeholder, hint }: TextFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      {(id) => (
        <span className="control">
          <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        </span>
      )}
    </FormField>
  );
}

export function FormTextarea({ label, value, onChange, placeholder, hint }: TextFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      {(id) => (
        <span className="control">
          <textarea id={id} rows={4} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        </span>
      )}
    </FormField>
  );
}

type SelectFieldProps = { label: string; value: string; options: OptionItem[]; onChange: (value: string) => void; hint?: string };

export function FormSelect({ label, value, options, onChange, hint }: SelectFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      {(id) => (
        <span className="control">
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={16} />
        </span>
      )}
    </FormField>
  );
}
