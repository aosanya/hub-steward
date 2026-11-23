import { hubPath } from "../../api";
import { hubModel } from "../../data/pages/agents";
import { modelCheck, statusChecks } from "../../data/pages/status";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Empty, Progress, SectionHeading, Stack, PageHeader } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { StatusTiles } from "../status/StatusTiles";

export function StatusView() {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { state: checks } = useLoaded(() => statusChecks(hub.id), [hub.id]);
  const { state: model } = useLoaded(() => hubModel(hub.id), [hub.id, hub.model_key_set]);
  const keySet = model.kind === "ready" ? model.value.keySet : hub.model_key_set === true;
  const provider = model.kind === "ready" ? model.value.provider : "";

  const rows = checks.kind === "ready" ? [...checks.value, modelCheck(keySet, provider)] : [];
  const ready = rows.filter((row) => row.done === true).length;
  const count = t("status.count").replace("{done}", String(ready)).replace("{total}", String(rows.length));
  const heading = ready === rows.length ? t("status.ready") : t("status.finishSettingUp");

  return (
    <>
      <PageHeader title={t("menu.status")} actions={keySet ? [] : [{ label: t("models.addModel"), icon: "plus", primary: true, to: hubPath(hub.id, "models") }]} />
      <div className="content">
        {checks.kind === "failed" && <Empty text={t("loadFailed")} failed />}
        {checks.kind === "ready" && (
          <Stack gap={14}>
            <SectionHeading title={heading} count={count} />
            <Progress pct={(ready / rows.length) * 100} />
            <StatusTiles rows={rows} hubId={hub.id} />
          </Stack>
        )}
      </div>
    </>
  );
}
