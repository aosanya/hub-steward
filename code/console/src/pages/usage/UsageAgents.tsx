import { breakdownOf, rankedOf, type Names, type UsageGroup, type UsageRow } from "../../data/usageBreakdown";
import { useI18n } from "../../i18n";
import { Cell, Card, DataTable, RankedBars, SectionTitle, Stack } from "../../ui";
import { countIn } from "./usageFormat";

type Props = { rows: UsageRow[]; names: Names; group: UsageGroup; roleName: string; onRole: (roleId: string) => void };

export function UsageAgents({ rows, names, group, roleName, onRole }: Props) {
  const { t, lang } = useI18n();
  const words = { byItself: t("usage.byItself"), unknownPerson: t("usage.unknownPerson") };
  const rankedBy = group === "person" || roleName ? "person" : "role";
  const tableBy = group === "person" ? "person" : "role";
  const title = roleName ? t("usage.whoUsed").replace("{role}", roleName) : group === "person" ? t("usage.byPerson") : t("usage.byAgent");
  const ranked = rankedOf(rows, rankedBy, names, words);
  const lines = breakdownOf(rows, tableBy, names, words);
  return (
    <Stack gap={20}>
      <Card title={title}>
        <RankedBars
          rows={ranked.map((one) => ({
            name: one.name,
            tokensIn: one.tokensIn,
            tokensOut: one.tokensOut,
            requests: one.requests,
            onOpen: rankedBy === "role" ? () => onRole(one.key) : undefined,
          }))}
        />
      </Card>
      <SectionTitle title={t("usage.breakdown")} />
      <DataTable
        columns={[group === "person" ? t("usage.colPerson") : t("usage.colAgent"), t("usage.colKind"), t("usage.colModel"), t("usage.colInput"), t("usage.colOutput"), t("usage.colRequests")]}
        empty={t("usage.noCalls")}
        rows={lines.map((line) => ({
          key: line.key,
          cells: [
            <Cell key="who" text={line.who} />,
            t(`usage.kind.${line.kind}`),
            line.model,
            <span className="count" key="in">
              {countIn(line.tokensIn, lang)}
            </span>,
            <span className="count" key="out">
              {countIn(line.tokensOut, lang)}
            </span>,
            <span className="count" key="requests">
              {countIn(line.requests, lang)}
            </span>,
          ],
        }))}
      />
    </Stack>
  );
}
