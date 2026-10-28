import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { hubPath } from "../../api";
import { kindOf } from "../../data/hubKind";
import { showsPage } from "../../data/menu";
import { listAlerts } from "../../data/pages/alerts";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import type { PageRow } from "../../types";
import { Cell, DataTable, Detail, Empty, FilterBar, Stack, TextLink, TitleRow } from "../../ui";
import { LoadFailed } from "../work/LoadFailed";
import { PageContent } from "../work/PageContent";
import { StateChip } from "../work/StateChip";
import { formatWhen } from "../work/formatWhen";
import { useLoaded } from "../../shell/useLoaded";

const shown = (value: unknown) => (typeof value === "string" ? value : "");

const alertLink = (hubId: string, id: string) => `${hubPath(hubId, "alerts")}?alert=${encodeURIComponent(id)}`;

export function AlertsView() {
  const { hub } = useConsole();
  const [params] = useSearchParams();
  const alert = params.get("alert");
  const room = hub.manager_room_id;
  return alert ? (
    <AlertPage key={`${hub.id}/${alert}`} hubId={hub.id} room={room} alert={alert} networkShown={showsPage(kindOf(hub), "network")} />
  ) : (
    <AlertsPage key={hub.id} hubId={hub.id} room={room} />
  );
}

function Raised({ at }: { at: string }) {
  const { lang } = useI18n();
  return <span className="count">{at === "" ? "—" : formatWhen(at, lang)}</span>;
}

function AlertsPage({ hubId, room }: { hubId: string; room: string | undefined }) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => listAlerts(hubId, room ? { room } : {}), [hubId, room]);
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState("all");

  const matches = (row: PageRow) =>
    (only === "all" || shown(row.state).toLowerCase() === only) && shown(row.alert).toLowerCase().includes(search.trim().toLowerCase());

  const rows = (list: PageRow[]) =>
    list.filter(matches).map((row, index) => ({
      key: `${shown(row.id)}/${index}`,
      cells: [
        <Cell key="alert" text={shown(row.alert)} to={alertLink(hubId, shown(row.id))} />,
        <StateChip key="state" state={shown(row.state)} />,
        <Raised key="time" at={shown(row.raised)} />,
      ],
      actions: (
        <TextLink to={alertLink(hubId, shown(row.id))} arrow size="sm">
          {t("rowOpen")}
        </TextLink>
      ),
    }));

  return (
    <>
      <TitleRow title={t("menu.alerts")} />
      <PageContent>
        {state.kind === "failed" ? <LoadFailed onRetry={reload} /> : null}
        {state.kind === "ready" ? (
          <Stack>
            <FilterBar
              placeholder={t("alertsSearch")}
              chips={[]}
              search={search}
              onSearch={setSearch}
              selects={[
                {
                  icon: "filter",
                  label: t("allStates"),
                  value: only,
                  onChange: setOnly,
                  options: [
                    { value: "all", label: t("allStates") },
                    { value: "open", label: t("stateOpen") },
                    { value: "acknowledged", label: t("stateAcknowledged") },
                    { value: "closed", label: t("stateClosed") },
                  ],
                },
              ]}
            />
            <DataTable columns={[t("alertsAlert"), t("colState"), t("colTime")]} rows={rows(state.value)} empty={t("noRows")} />
          </Stack>
        ) : null}
      </PageContent>
    </>
  );
}

function AlertPage({ hubId, room, alert, networkShown }: { hubId: string; room: string | undefined; alert: string; networkShown: boolean }) {
  const { t, lang } = useI18n();
  const { state, reload } = useLoaded(() => listAlerts(hubId, room ? { room } : {}), [hubId, room]);
  const row = state.kind === "ready" ? state.value.find((candidate) => shown(candidate.id) === alert) : undefined;

  return (
    <>
      <TitleRow title={row ? shown(row.alert) : t("menu.alerts")} />
      <PageContent>
        {state.kind === "failed" ? <LoadFailed onRetry={reload} /> : null}
        {state.kind === "ready" && !row ? <Empty text={t("noRows")} /> : null}
        {row ? (
          <Detail
            title={shown(row.alert)}
            actions={
              networkShown ? (
                <TextLink to={hubPath(hubId, "network")} arrow size="sm">
                  {t("opsOpenNetwork")}
                </TextLink>
              ) : undefined
            }
            pairs={[
              [t("colState"), <StateChip key="state" state={shown(row.state)} />],
              [t("alertsRaised"), shown(row.raised) === "" ? "—" : formatWhen(shown(row.raised), lang)],
              [t("alertsMessage"), shown(row.message)],
            ]}
          />
        ) : null}
      </PageContent>
    </>
  );
}
