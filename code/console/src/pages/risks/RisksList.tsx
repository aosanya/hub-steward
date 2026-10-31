import { useState } from "react";
import { useI18n } from "../../i18n";
import type { RiskSummary } from "../../data/pages/risks";
import { byName, matching } from "../../data/listView";
import { Card, Detail, Empty, FilterBar, Stack, TextLink } from "../../ui";
import { risksHref } from "./risksLinks";

const heading = (risk: RiskSummary) => [risk.code, risk.title].filter(Boolean).join(" · ");

function RiskCard({ hubId, risk }: { hubId: string; risk: RiskSummary }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const to = risksHref(hubId, { risk: risk.id });
  return (
    <Card
      title={heading(risk)}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <TextLink to={to} size="sm">
          {t("edit")}
        </TextLink>
      }
    >
      <Detail
        pairs={[
          [t("risks.topEvent"), risk.topEvent || "—"],
          [t("risks.owner"), risk.owner || t("risks.noOwner")],
        ]}
      />
    </Card>
  );
}

export function RisksList({ hubId, risks }: { hubId: string; risks: RiskSummary[] }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const shown = byName(
    matching(risks, (risk) => [risk.title, risk.code, risk.topEvent, risk.owner], search),
    (risk) => risk.title,
  );
  return (
    <Stack gap={20}>
      <FilterBar placeholder={t("risks.search")} chips={[]} search={search} onSearch={setSearch} />
      {shown.length === 0 ? <Empty text={t("noRows")} /> : shown.map((risk) => <RiskCard key={risk.id} hubId={hubId} risk={risk} />)}
    </Stack>
  );
}
