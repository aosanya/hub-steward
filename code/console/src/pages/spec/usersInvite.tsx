import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import type { FieldSpec, OptionItem } from "../../types";
import { FormObject, type FormValues } from "../../ui";
import type { Outcome } from "./sendAction";
import { sendAction } from "./sendAction";
import { pickerOptions } from "./pickerOptions";
import { textOf } from "./usersRead";

type InviteFormProps = { hubId: string; onOutcome: (result: Outcome) => void; onCancel: () => void };

const fieldsFor = (groups: OptionItem[]): FieldSpec[] => [
  { name: "group_id", component: "select", options: groups, required: true },
  { name: "actor_code", component: "text" },
  { name: "actor_id", component: "text" },
  { name: "name", component: "text" },
];

const named = (values: FormValues) => (textOf(values.actor_code).trim() ? 1 : 0) + (textOf(values.actor_id).trim() ? 1 : 0);

export function InviteForm({ hubId, onOutcome, onCancel }: InviteFormProps) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<OptionItem[] | null>(null);

  useEffect(() => {
    let current = true;
    pickerOptions("groups", hubId).then((options) => {
      if (current) setGroups(options);
    });
    return () => {
      current = false;
    };
  }, [hubId]);

  if (!groups) return null;

  const submit = async (values: FormValues) => {
    if (named(values) !== 1) return t("users.giveOne");
    const groupName = groups.find((group) => group.value === values.group_id)?.label ?? "";
    const result = await sendAction("users", "users", hubId, { ...values, group_name: groupName });
    if (result === "failed") return t("submitFailed");
    onOutcome(result);
  };

  return <FormObject title="" tool="actor_invite_to_group" fields={fieldsFor(groups)} onSubmit={submit} onCancel={onCancel} />;
}
