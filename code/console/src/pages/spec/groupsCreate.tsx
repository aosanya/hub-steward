import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { FormObject, type FormValues } from "../../ui";
import { sendAction, type Outcome } from "./sendAction";

type CreateGroupFormProps = { hubId: string; onOutcome: (result: Outcome) => void; onCancel: () => void };

const fields: FieldSpec[] = [{ name: "name", component: "text", required: true }];

export function CreateGroupForm({ hubId, onOutcome, onCancel }: CreateGroupFormProps) {
  const { t } = useI18n();
  const submit = async (values: FormValues) => {
    const result = await sendAction("groups", "create", hubId, values);
    if (result === "failed") return t("submitFailed");
    onOutcome(result);
  };
  return <FormObject title="" tool="actor_create_group" fields={fields} onSubmit={submit} onCancel={onCancel} />;
}
