import { toolSchema } from "../../data/actionSchema";
import { limitedRoles, roleLimitDrawing, roleLimitsTool, setRoleLimit, type RoleLimitKey } from "../../data/roleLimits";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Empty, SchemaForm, useNotice, type FormValues } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";

type RoleLimitsFormProps = { limit: RoleLimitKey; role?: string; value?: number | null; onClose: () => void };

const drawForm = async (hubId: string, limit: RoleLimitKey) => {
  const [schema, roles] = await Promise.all([toolSchema(roleLimitDrawing(limit)), limitedRoles(hubId)]);
  return { schema, roles };
};

export function RoleLimitsForm({ limit, role = "", value = null, onClose }: RoleLimitsFormProps) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { show } = useNotice();
  const { state: drawn } = useLoaded(() => drawForm(hub.id, limit), [hub.id, limit]);

  if (drawn.kind === "loading") return null;
  if (drawn.kind === "failed") return <Empty failed text={t("loadFailed")} />;

  const { schema, roles } = drawn.value;
  const choices = { roleID: roles.map((held) => ({ value: held.id, label: held.name })) };
  const picked = roles.find((held) => held.id === role);
  const startingValue = value ?? picked?.limits[limit] ?? undefined;
  const initial = { ...(picked ? { roleID: picked.id } : {}), ...(startingValue === undefined ? {} : { [limit]: startingValue }) };

  const submit = async (values: FormValues) => {
    await setRoleLimit(hub.id, String(values.roleID ?? ""), limit, Number(values[limit]));
    show(t("notice.limitsSaved"));
    onClose();
  };

  return <SchemaForm title="" tool={roleLimitsTool} schema={schema} choices={choices} initial={initial} submitLabel={t("save")} onSubmit={submit} onCancel={onClose} />;
}
