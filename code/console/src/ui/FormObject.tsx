import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { Button } from "./Button";
import { Card } from "./Card";
import { Chip } from "./Chip";
import { Field } from "./Field";
import { currentValue, missingRequired, submittedValues } from "./fieldValues";
import { Stack, stackStyle } from "./Layout";
import type { FormObjectProps, FormValues } from "./props";

const rowsFrom = 4;

export function FormObject({ title, fields, pending, tool, initial, errors, submitLabel, onSubmit, onCancel }: FormObjectProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<FormValues>(initial ?? {});
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const rows = fields.length >= rowsFrom;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const blank = missingRequired(fields, values);
    setMissing(blank);
    if (blank.length > 0) {
      setError(`${t("required")}: ${blank.join(", ")}`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const problem = await onSubmit(submittedValues(fields, values));
      if (typeof problem === "string") setError(problem);
    } catch {
      setError(t("submitFailed"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setValues(initial ?? {});
    setError("");
    setMissing([]);
    setGeneration((n) => n + 1);
    onCancel();
  };

  const change = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
    setMissing((current) => current.filter((item) => item !== name));
  };

  const shown = fields.map((spec) => (
    <Field
      key={spec.name}
      spec={spec}
      layout={rows ? "rows" : "stack"}
      value={currentValue(spec, values)}
      error={missing.includes(spec.name) ? t("required") : errors?.[spec.name]}
      onChange={(value) => change(spec.name, value)}
    />
  ));

  return (
    <Card title={title || undefined}>
      <form key={generation} className="stack" style={stackStyle(18)} noValidate onSubmit={submit}>
        {tool ? <span className="form-tool">{tool}</span> : null}
        {rows ? <div className="settings">{shown}</div> : <Stack>{shown}</Stack>}
        {error ? (
          <p className="field-error error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-foot">
          <Button type="submit" disabled={busy}>
            {submitLabel ?? t("submit")}
          </Button>
          <Button kind="quiet" onClick={cancel}>
            {t("cancel")}
          </Button>
          {pending ? (
            <>
              <Chip kind="warn">{t("waitingForApproval")}</Chip>
              <span className="muted">{t("pendingApproval")}</span>
            </>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
