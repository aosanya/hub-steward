import { hubPath } from "../../api";
import { defaultGroup, forRole, loadNames, loadUsage, rolesOf } from "../../data/usageBreakdown";
import { isStaff } from "../../data/seat";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { useLoaded } from "../../shell/useLoaded";
import { ButtonLink, Empty, Stack, TitleRow } from "../../ui";
import { UsageAgents } from "./UsageAgents";
import { UsageOverview } from "./UsageOverview";
import { UsageToolbar } from "./UsageToolbar";
import { UsageWork } from "./UsageWork";
import { useUsageQuery } from "./useUsageQuery";

export type UsageKindOfPage = "overview" | "work" | "agents";

function UsageBody({ which }: { which: UsageKindOfPage }) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const query = useUsageQuery();
  const group = which === "agents" ? query.group : defaultGroup;
  const { state } = useLoaded(
    async () => {
      const [usage, names] = await Promise.all([loadUsage(hub.id, query.span, group), loadNames(hub.id)]);
      return { usage, names };
    },
    [hub.id, query.span, group],
  );

  if (state.kind === "failed") return <Empty failed text={t("loadFailed")} />;

  const usage = state.kind === "ready" ? state.value.usage : null;
  const roleName = (usage && rolesOf(usage.rows).get(query.role)) || "";
  const toolbar = <UsageToolbar query={query} roleName={roleName} showGroup={which === "agents"} />;
  if (state.kind === "loading" || !usage) return <Stack gap={20}>{toolbar}</Stack>;

  const { names } = state.value;
  const rows = roleName ? forRole(usage.rows, query.role) : usage.rows;

  if (usage.rows.length === 0)
    return (
      <Stack gap={20}>
        {toolbar}
        <Empty text={t("usage.noCalls")} action={<ButtonLink to={hubPath(hub.id, "models")}>{t("usage.testModel")}</ButtonLink>} />
      </Stack>
    );

  return (
    <Stack gap={20}>
      {toolbar}
      {which === "overview" ? <UsageOverview usage={usage} rows={rows} /> : null}
      {which === "work" ? <UsageWork usage={usage} rows={rows} /> : null}
      {which === "agents" ? <UsageAgents rows={rows} names={names} group={query.group} roleName={roleName} onRole={(role) => query.change({ role })} /> : null}
    </Stack>
  );
}

export function UsagePage({ which }: { which: UsageKindOfPage }) {
  const { t } = useI18n();
  const { hub } = useConsole();
  return (
    <>
      <TitleRow title={t("menu.usage")} />
      <div className="content">{isStaff(hub.role) ? <Empty text={t("usage.managersOnly")} /> : <UsageBody key={hub.id + "/" + which} which={which} />}</div>
    </>
  );
}
