import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { FormObject, type FormValues } from "../../ui";
import { sendAction, type Outcome } from "./sendAction";
import type { GroupLine } from "./usersRead";

type JoinModeFormProps = { hubId: string; group: GroupLine; onOutcome: (result: Outcome) => void; onCancel: () => void };

export function JoinModeForm({ hubId, group, onOutcome, onCancel }: JoinModeFormProps) {
  const { t } = useI18n();
  const fields: FieldSpec[] = [
    {
      name: "join_mode",
      component: "radios",
      required: true,
      options: [
        { value: "open", label: t("groups.joinOpen") },
        { value: "confirmed", label: t("groups.joinApproval") },
      ],
    },
  ];

  const submit = async (values: FormValues) => {
    if (values.join_mode === group.mode) return t("groups.alreadyThat");
    const result = await sendAction("groups", "joinMode", hubId, { id: group.id, group_name: group.name, join_mode: values.join_mode });
    if (result === "failed") return t("submitFailed");
    onOutcome(result);
  };

  return <FormObject title="" tool="actor_set_group_join_mode" fields={fields} onSubmit={submit} onCancel={onCancel} />;
}
