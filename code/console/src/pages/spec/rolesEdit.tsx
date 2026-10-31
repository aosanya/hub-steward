import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { FormObject, type FormValues } from "../../ui";
import { sendAction, type Outcome } from "./sendAction";
import type { RoleLine } from "./usersRead";

type EditRoleFormProps = { hubId: string; line: RoleLine; onOutcome: (result: Outcome) => void; onCancel: () => void };

const fields: FieldSpec[] = [
  { name: "name", component: "text", required: true },
  { name: "description", component: "textarea" },
  { name: "agent", component: "toggle" },
];

export function EditRoleForm({ hubId, line, onOutcome, onCancel }: EditRoleFormProps) {
  const { t } = useI18n();
  const submit = async (values: FormValues) => {
    const result = await sendAction("roles", "role", hubId, { ...values, role_id: line.id });
    if (result === "failed") return t("submitFailed");
    onOutcome(result);
  };
  return (
    <FormObject
      title=""
      tool="agency_update_role"
      fields={fields}
      initial={{ name: line.name, description: line.description, agent: line.ai }}
      onSubmit={submit}
      onCancel={onCancel}
    />
  );
}
