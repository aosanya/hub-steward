import { useState, type FormEvent } from "react";
import { Card } from "../../ui/Card";
import { Field } from "../../ui/Field";
import type { FieldSpec } from "./types";

type Props = {
  title: string;
  fields: FieldSpec[];
  submitLabel: string;
  fixedArgs?: Record<string, unknown>;
  onSubmit: (args: Record<string, unknown>) => Promise<unknown>;
};

type Values = Record<string, string>;
type Errors = Record<string, string>;

function validate(fields: FieldSpec[], values: Values): Errors {
  const errors: Errors = {};
  for (const field of fields) {
    const value = (values[field.name] ?? "").trim();
    if (value === "") {
      if (field.required) errors[field.name] = "Required";
      continue;
    }
    if (field.kind === "number" && Number.isNaN(Number(value))) errors[field.name] = "Enter a number";
  }
  return errors;
}

function argsOf(fields: FieldSpec[], values: Values, fixedArgs: Record<string, unknown> | undefined): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const field of fields) {
    const value = (values[field.name] ?? "").trim();
    if (value === "") continue;
    args[field.name] = field.kind === "number" ? Number(value) : value;
  }
  return { ...args, ...fixedArgs };
}

function describe(result: unknown): string {
  if (typeof result === "string" && result !== "") return result;
  if (result && typeof result === "object") {
    const { message } = result as { message?: unknown };
    if (typeof message === "string" && message !== "") return message;
  }
  return "Done";
}

function Choice({ field, value, error, onPick }: { field: FieldSpec; value: string; error?: string; onPick: (value: string) => void }) {
  return (
    <div className="field" role="radiogroup" aria-label={field.label}>
      <span className="flabel">{field.label}</span>
      <div className="opts">
        {(field.options ?? []).map((option) => (
          <button key={option} type="button" role="radio" aria-checked={value === option} className={value === option ? "opt on" : "opt"} onClick={() => onPick(option)}>
            {option}
          </button>
        ))}
      </div>
      {error ? <p className="ferr">{error}</p> : null}
    </div>
  );
}

export function FormBlock({ title, fields, submitLabel, fixedArgs, onSubmit }: Props) {
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(fields, values);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      setResult(describe(await onSubmit(argsOf(fields, values, fixedArgs))));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="attached" onSubmit={submit} noValidate aria-label={title}>
      <Card
        title={title}
        footer={
          result === null ? (
            <button type="submit" className="btn primary" disabled={busy}>
              {submitLabel}
            </button>
          ) : undefined
        }
      >
        <div className="fobj">
          {fields.map((field) =>
            field.kind === "choice" ? (
              <Choice key={field.name} field={field} value={values[field.name] ?? ""} error={errors[field.name]} onPick={(value) => set(field.name, value)} />
            ) : (
              <Field
                key={field.name}
                label={field.label}
                type={field.kind === "date" ? "date" : "text"}
                inputMode={field.kind === "number" ? "decimal" : undefined}
                value={values[field.name] ?? ""}
                error={errors[field.name]}
                disabled={result !== null}
                onChange={(event) => set(field.name, event.target.value)}
              />
            ),
          )}
        </div>
        {failure ? <p className="ferr" role="alert">{failure}</p> : null}
        {result !== null ? (
          <p className="note success" role="status">
            {result}
          </p>
        ) : null}
      </Card>
    </form>
  );
}
