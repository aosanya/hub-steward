import { applyLimitRaise, limitRaiseApproval, limitRaiseParamsOf } from "../../data/limitRaise";
import { useI18n } from "../../i18n";
import { ApprovalCard } from "../../shell/ActionApproval";
import { useLoaded } from "../../shell/useLoaded";
import { Empty } from "../../ui";

type LimitRaiseViewProps = { hubId: string; title: string; params: Record<string, unknown>; onDone: () => void };

const notUnderstood = () => Promise.reject(new Error("that was not understood"));

export function LimitRaiseView({ hubId, params, onDone }: LimitRaiseViewProps) {
  const { t, lang } = useI18n();
  const asked = limitRaiseParamsOf(params);
  const { state } = useLoaded(() => (asked ? limitRaiseApproval(hubId, asked) : notUnderstood()), [hubId, JSON.stringify(params)]);

  if (!asked || state.kind === "failed") return <Empty failed text={t("loadFailed")} />;
  if (state.kind === "loading") return null;

  const count = (value: number) => value.toLocaleString(lang);
  const { name, tool } = state.value;
  const title = t("limitRaise.title").replace("{limit}", t(`limits.${asked.key}`)).replace("{value}", count(asked.value));
  const detail = t("limitRaise.text").replace("{name}", name).replace("{max}", count(asked.max)).replace("{used}", count(asked.used)).replace("{tool}", tool);

  return <ApprovalCard key={JSON.stringify(params)} title={title} text={detail} notice={t("notice.limitsSaved")} run={() => applyLimitRaise(hubId, asked)} onDone={onDone} />;
}
