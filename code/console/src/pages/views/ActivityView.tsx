import { useState } from "react";
import { hubPath } from "../../api";
import { byName, matching } from "../../data/listView";
import { listActivity } from "../../data/pages/activity";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import type { PageRow } from "../../types";
import { Card, Detail, Empty, FilterBar, Stack, TextLink, TitleRow } from "../../ui";
import { LoadFailed } from "../work/LoadFailed";
import { PageContent } from "../work/PageContent";
import { StateChip } from "../work/StateChip";
import { useLoaded } from "../../shell/useLoaded";

const shown = (value: unknown) => (typeof value === "string" ? value : "");

const nothing = "—";

export function ActivityView() {
  const { hub } = useConsole();
  return <ActivityPage key={hub.id} hubId={hub.id} />;
}

function RoleCard({ hubId, row }: { hubId: string; row: PageRow }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Card
      title={shown(row.name)}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        shown(row.id) === "" ? undefined : (
          <TextLink to={hubPath(hubId, "agent-edit", shown(row.id), "limits")} arrow size="sm">
            {t("rowOpen")}
          </TextLink>
        )
      }
    >
      <Detail
        pairs={[
          [t("colState"), <StateChip key="state" state={shown(row.state)} />],
          [t("activityLastAction"), nothing],
          [t("colTime"), nothing],
        ]}
      />
    </Card>
  );
}

function ActivityPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => listActivity(hubId), [hubId]);
  const [search, setSearch] = useState("");

  const cards = (list: PageRow[]) => {
    const listed = byName(matching(list, (row) => [shown(row.name)], search), (row) => shown(row.name));
    if (listed.length === 0) return <Empty text={t("noRows")} />;
    return listed.map((row, index) => <RoleCard key={`${shown(row.id)}/${index}`} hubId={hubId} row={row} />);
  };

  return (
    <>
      <TitleRow title={t("menu.activity")} />
      <PageContent>
        {state.kind === "failed" ? <LoadFailed onRetry={reload} /> : null}
        {state.kind === "ready" ? (
          <Stack gap={20}>
            <FilterBar placeholder={t("activitySearch")} chips={[]} search={search} onSearch={setSearch} />
            {cards(state.value)}
          </Stack>
        ) : null}
      </PageContent>
    </>
  );
}
