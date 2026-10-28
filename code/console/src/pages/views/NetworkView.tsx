import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { hubPath } from "../../api";
import { byName } from "../../data/listView";
import { listNetwork } from "../../data/pages/network";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import type { PageRow } from "../../types";
import { Card, DataTable, Detail, Empty, FilterBar, SectionTitle, Stack, TextLink, TitleRow } from "../../ui";
import { LoadFailed } from "../work/LoadFailed";
import { PageContent } from "../work/PageContent";
import { StateChip } from "../work/StateChip";
import { formatWhen } from "../work/formatWhen";
import { useLoaded } from "../../shell/useLoaded";

const shown = (value: unknown) => (typeof value === "string" ? value : "");

const clientState = (state: string) => (state.toLowerCase() === "offline" ? "no network" : state);

const isOnline = (row: PageRow) => shown(row.state).toLowerCase() === "online";

export function NetworkView() {
  const { hub } = useConsole();
  const [params] = useSearchParams();
  const device = params.get("device");
  return device ? <DevicePage key={`${hub.id}/${device}`} hubId={hub.id} device={device} /> : <DevicesPage key={hub.id} hubId={hub.id} />;
}

function LastSeen({ at }: { at: unknown }) {
  const { lang } = useI18n();
  const text = shown(at);
  return <span className="count">{text === "" ? "—" : formatWhen(text, lang)}</span>;
}

function DeviceCard({ hubId, row }: { hubId: string; row: PageRow }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Card
      title={shown(row.name)}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <TextLink to={`${hubPath(hubId, "network")}?device=${encodeURIComponent(shown(row.id))}`} arrow size="sm">
          {t("rowOpen")}
        </TextLink>
      }
    >
      <Detail
        pairs={[
          [t("netType"), shown(row.type)],
          [t("colState"), <StateChip key="state" state={shown(row.state)} />],
          [t("netLastSeen"), <LastSeen key="seen" at={row.last_seen} />],
        ]}
      />
    </Card>
  );
}

function DevicesPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => listNetwork(hubId, {}), [hubId]);
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState("all");

  const matches = (row: PageRow) => {
    if (only === "online" && !isOnline(row)) return false;
    if (only === "fault" && isOnline(row)) return false;
    return shown(row.name).toLowerCase().includes(search.trim().toLowerCase());
  };

  const cards = (list: PageRow[]) => {
    const listed = byName(list.filter(matches), (row) => shown(row.name));
    if (listed.length === 0) return <Empty text={t("noRows")} />;
    return listed.map((row) => (
      <DeviceCard key={shown(row.id)} hubId={hubId} row={row} />
    ));
  };

  return (
    <>
      <TitleRow title={t("menu.network")} />
      <PageContent>
        {state.kind === "failed" ? <LoadFailed onRetry={reload} /> : null}
        {state.kind === "ready" ? (
          <Stack gap={20}>
            <FilterBar
              placeholder={t("netSearch")}
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
                    { value: "online", label: t("stateOnline") },
                    { value: "fault", label: t("stateFault") },
                  ],
                },
              ]}
            />
            {cards(state.value)}
          </Stack>
        ) : null}
      </PageContent>
    </>
  );
}

function DevicePage({ hubId, device }: { hubId: string; device: string }) {
  const { t, lang } = useI18n();
  const { state, reload } = useLoaded(async () => {
    const [devices, clients] = await Promise.all([listNetwork(hubId, {}), listNetwork(hubId, { device })]);
    return { row: devices.find((candidate) => shown(candidate.id) === device), clients };
  }, [hubId, device]);

  const row = state.kind === "ready" ? state.value.row : undefined;
  const title = row ? shown(row.name) : t("menu.network");

  const clientRows = (clients: PageRow[]) =>
    clients.map((client, index) => ({
      key: `${shown(client.id)}/${index}`,
      cells: [
        shown(client.name),
        shown(client.type),
        <StateChip key="state" state={clientState(shown(client.state))} />,
      ],
    }));

  return (
    <>
      <TitleRow title={title} />
      <PageContent>
        {state.kind === "failed" ? <LoadFailed onRetry={reload} /> : null}
        {state.kind === "ready" && !row ? <Empty text={t("noRows")} /> : null}
        {state.kind === "ready" && row ? (
          <Stack gap={20}>
            <Detail
              title={shown(row.name)}
              actions={
                <TextLink to={hubPath(hubId, "alerts")} arrow size="sm">
                  {t("opsOpenAlerts")}
                </TextLink>
              }
              pairs={[
                [t("netType"), shown(row.type)],
                [t("colState"), <StateChip key="state" state={shown(row.state)} />],
                [t("netLastSeen"), shown(row.last_seen) === "" ? "—" : formatWhen(shown(row.last_seen), lang)],
              ]}
            />
            <SectionTitle title={t("netClients")} />
            <DataTable columns={[t("netClient"), t("netType"), t("colState")]} rows={clientRows(state.value.clients)} empty={t("noRows")} />
          </Stack>
        ) : null}
      </PageContent>
    </>
  );
}
