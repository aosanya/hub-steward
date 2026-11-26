import { useState } from "react";
import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { FormObject, type FormValues } from "../../ui";
import { RemoveAsk } from "./removeAsk";
import { failureOf, sendAction } from "./sendAction";

export type GoalKind = "goal" | "objective";

const fields: FieldSpec[] = [
  { name: "title", component: "text", required: true },
  { name: "description", component: "textarea" },
];

const idKey = (kind: GoalKind) => kind + "_id";

type EditGoalFormProps = { hubId: string; kind: GoalKind; id: string; title: string; description: string; onSaved: () => void; onCancel: () => void };

export function EditGoalForm({ hubId, kind, id, title, description, onSaved, onCancel }: EditGoalFormProps) {
  const { t } = useI18n();
  const submit = async (values: FormValues) => {
    const result = await sendAction("goals", kind, hubId, { ...values, [idKey(kind)]: id });
    if (result === "failed") return t("submitFailed");
    onSaved();
  };
  return <FormObject title="" tool={"agency_update_" + kind} fields={fields} initial={{ title, description }} submitLabel={t("save")} onSubmit={submit} onCancel={onCancel} />;
}

type RemoveGoalAskProps = { hubId: string; kind: GoalKind; id: string; title: string; onRemoved: () => void; onCancel: () => void };

export function RemoveGoalAsk({ hubId, kind, id, title, onRemoved, onCancel }: RemoveGoalAskProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const remove = async () => {
    setBusy(true);
    setProblem("");
    const result = await sendAction("goals", kind === "goal" ? "removeGoal" : "removeObjective", hubId, { [idKey(kind)]: id });
    setBusy(false);
    if (result === "failed") setProblem(failureOf() || t("submitFailed"));
    else onRemoved();
  };
  return (
    <RemoveAsk
      question={t(kind === "goal" ? "goals.removeGoalAsk" : "goals.removeObjectiveAsk").replace("{name}", title)}
      confirm={t(kind === "goal" ? "goals.removeGoal" : "goals.removeObjective")}
      busy={busy}
      error={problem}
      onConfirm={remove}
      onCancel={onCancel}
    />
  );
}
