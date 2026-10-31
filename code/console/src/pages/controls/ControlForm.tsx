import { useState } from "react";
import { useI18n } from "../../i18n";
import { FormCard, FormSelect, FormText } from "../spec/goalsForm";
import { useLoaded } from "../../shell/useLoaded";
import { listWorkflowChoices, runWorkflowAction, type ControlFields } from "./controlFields";

type ControlFormProps = {
  hubId: string;
  title: string;
  initial: ControlFields;
  save: (fields: ControlFields) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
};

export function ControlForm({ hubId, title, initial, save, onSaved, onCancel }: ControlFormProps) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const runs = fields.action.trim() === runWorkflowAction;
  const { state } = useLoaded(() => listWorkflowChoices(hubId), [hubId]);
  const set = (name: keyof ControlFields) => (value: string) => setFields((current) => ({ ...current, [name]: value }));

  const submit = async () => {
    if (!fields.text.trim()) {
      setError(`${t("required")}: ${t("controls.text")}`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await save(fields);
    } catch {
      setBusy(false);
      setError(t("submitFailed"));
      return;
    }
    setBusy(false);
    onSaved();
  };

  const workflows = state.kind === "ready" ? state.value : [];
  const workflowOptions = [{ value: "", label: t("controls.notSet") }, ...workflows.map((workflow) => ({ value: workflow.id, label: workflow.name }))];
  const severityOptions = ["", "low", "medium", "high"].map((value) => ({ value, label: value ? t("controls." + value) : t("controls.notSet") }));

  return (
    <FormCard title={title} submit={t("save")} cancel={t("cancel")} note={t("risks.saved")} error={error} busy={busy} onSubmit={submit} onCancel={onCancel}>
      <FormText label={t("controls.text")} value={fields.text} onChange={set("text")} />
      <FormText label={t("controls.action")} value={fields.action} onChange={set("action")} />
      <FormText label={t("controls.condField")} value={fields.cond_field} onChange={set("cond_field")} />
      <FormText label={t("controls.condOperator")} value={fields.cond_operator} onChange={set("cond_operator")} />
      <FormText label={t("controls.condValue")} value={fields.cond_value} onChange={set("cond_value")} />
      <FormText label={t("controls.onBreach")} value={fields.on_breach} onChange={set("on_breach")} />
      {runs ? <FormSelect label={t("controls.workflow")} value={fields.workflow_id} options={workflowOptions} onChange={set("workflow_id")} /> : null}
      <FormSelect label={t("controls.severity")} value={fields.severity} options={severityOptions} onChange={set("severity")} />
    </FormCard>
  );
}
