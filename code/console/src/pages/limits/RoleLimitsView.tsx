import { roleLimitParamsOf } from "../../data/roleLimitAction";
import { useI18n } from "../../i18n";
import { Empty } from "../../ui";
import { RoleLimitsForm } from "./RoleLimitsForm";

type RoleLimitsViewProps = { hubId: string; title: string; params: Record<string, unknown>; onDone: () => void };

export function RoleLimitsView({ params, onDone }: RoleLimitsViewProps) {
  const { t } = useI18n();
  const asked = roleLimitParamsOf(params);
  if (!asked) return <Empty failed text={t("loadFailed")} />;
  return <RoleLimitsForm key={JSON.stringify(asked)} limit={asked.limit} role={asked.role} value={asked.value} onClose={onDone} />;
}
