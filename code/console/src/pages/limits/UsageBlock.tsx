import { hubPath } from "../../api";
import type { ModelAccount } from "../../data/modelLimits";
import { isStaff } from "../../data/seat";
import { isReached, modelUsage, shareOf, unassignedRole, type LimitUse, type RoleUse } from "../../data/modelUsage";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Cell, Chip, DataTable, Empty, SectionTitle, Stack, TextLink, Tile } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";

type Count = (value: number) => string;

const shareChip = (row: LimitUse, t: (key: string) => string) => {
  if (row.used === null) return <Chip kind="mute">{t("usage.capOnEachCall")}</Chip>;
  if (isReached(row)) return <Chip kind="bad">{t("usage.reached")}</Chip>;
  return <Chip kind="mute">{`${shareOf(row.used, row.max)}%`}</Chip>;
};

const limitRow = (row: LimitUse, t: (key: string) => string, count: Count) => ({
  key: row.key,
  cells: [
    t(`limits.${row.key}`),
    row.used === null ? <span className="muted">{t("usage.notCounted")}</span> : <span className="count">{count(row.used)}</span>,
    <span className="count" key="max">
      {count(row.max)}
    </span>,
    shareChip(row, t),
  ],
});

const roleRow = (role: RoleUse, count: Count, t: (key: string) => string) => ({
  key: role.id,
  cells: [
    <Cell key="name" text={role.id === unassignedRole ? t("usage.unassigned") : role.name} />,
    <span className="count" key="today">
      {count(role.today)}
    </span>,
    <span className="count" key="month">
      {count(role.month)}
    </span>,
    <span className="count" key="requests">
      {count(role.requests)}
    </span>,
    <Chip key="share" kind="mute">{`${role.share}%`}</Chip>,
  ],
});

export function UsageBlock({ account }: { account: ModelAccount }) {
  const { t, lang } = useI18n();
  const { hub } = useConsole();
  const { state: usage } = useLoaded(() => modelUsage(hub.id, account), [hub.id, account.id]);
  const count: Count = (value) => value.toLocaleString(lang);

  if (usage.kind === "loading") return null;
  if (usage.kind === "failed") return <Empty failed text={t("loadFailed")} />;

  const { rows, reached, roles } = usage.value;
  return (
    <Stack>
      {reached ? <Tile label={t("usage.limitReached")} value={reached} state="warn" to={hubPath(hub.id, "models", account.id, "limits")} /> : null}
      <SectionTitle
        title={t("usage.againstEachLimit")}
        right={
          isStaff(hub.role) ? undefined : (
            <TextLink to={hubPath(hub.id, "usage-overview")} arrow size="sm">
              {t("usage.seeAll")}
            </TextLink>
          )
        }
      />
      <DataTable
        columns={[t("usage.colLimit"), t("usage.colUsed"), t("usage.colMax"), t("usage.colShare")]}
        empty={t("usage.noLimit")}
        rows={rows.map((row) => limitRow(row, t, count))}
      />
      <SectionTitle title={t("usage.byRole")} />
      {roles === null ? (
        <Empty failed text={t("loadFailed")} />
      ) : (
        <DataTable
          columns={[t("usage.colRole"), t("usage.colToday"), t("usage.colMonth"), t("usage.colRequests"), t("usage.colShare")]}
          empty={t("usage.noRoles")}
          rows={roles.map((role) => roleRow(role, count, t))}
        />
      )}
    </Stack>
  );
}
