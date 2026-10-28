import { useState } from "react";
import { byName, matching } from "../../data/listView";
import { useI18n } from "../../i18n";
import type { PageRow } from "../../types";
import { Card, Detail, Empty, FilterBar, Stack, StatusLine, TextLink, TitleRow } from "../../ui";
import { goalsHref, useArrivedNote } from "./goalsLinks";
import { useSpecPage } from "./useSpecPage";

const textOf = (value: unknown) => (value === undefined || value === null ? "" : String(value));

function GoalCard({ hubId, row }: { hubId: string; row: PageRow }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Card
      title={[textOf(row.code), textOf(row.title)].filter(Boolean).join(" · ")}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <TextLink to={goalsHref(hubId, { goal: textOf(row.id) })} size="sm">
          {t("edit")}
        </TextLink>
      }
    >
      <Detail pairs={[[t("goals.objectives"), textOf(row.objectives) || "—"]]} />
    </Card>
  );
}

export function GoalList({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state } = useSpecPage(hubId, "goals");
  const note = useArrivedNote();
  const [search, setSearch] = useState("");
  const rows = state.kind === "ready" ? state.rows : null;
  const shown = byName(
    matching(rows ?? [], (row) => [textOf(row.title), textOf(row.code)], search),
    (row) => textOf(row.title),
  );

  const body = () => {
    if (state.kind === "loading") return null;
    if (rows === null) return <Empty text={t("loadFailed")} failed />;
    return (
      <Stack gap={20}>
        {note.text ? <StatusLine text={note.text} failed={note.failed} /> : null}
        {rows.length > 0 ? <FilterBar placeholder={t("goals.search")} chips={[]} search={search} onSearch={setSearch} /> : null}
        {shown.length === 0 ? <Empty text={t("noRows")} /> : shown.map((row, index) => <GoalCard key={textOf(row.id) || String(index)} hubId={hubId} row={row} />)}
      </Stack>
    );
  };

  return (
    <>
      <TitleRow title={t("menu.goals")} primary={t("goals.add")} primaryTo={goalsHref(hubId, { add: "goal" })} />
      <div className="content">{body()}</div>
    </>
  );
}
