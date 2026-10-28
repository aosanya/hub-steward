import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { FormObject, type FormValues } from "../../ui";
import { sendAction, type Outcome } from "./sendAction";

type AddRoleFormProps = { hubId: string; onOutcome: (result: Outcome) => void; onCancel: () => void };

const fields: FieldSpec[] = [
  { name: "name", component: "text", required: true },
  { name: "description", component: "textarea" },
];

export function AddRoleForm({ hubId, onOutcome, onCancel }: AddRoleFormProps) {
  const { t } = useI18n();
  const submit = async (values: FormValues) => {
    const result = await sendAction("roles", "roles", hubId, values);
    if (result === "failed") return t("submitFailed");
    onOutcome(result);
  };
  return <FormObject title="" tool="agency_create_role" fields={fields} onSubmit={submit} onCancel={onCancel} />;
}
