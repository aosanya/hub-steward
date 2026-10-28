import { hubPath } from "../../api";
import { kindOf } from "../../data/hubKind";
import { showsPage } from "../../data/menu";
import { operationsPage, overviewOf, type Overview } from "../../data/pages/operations";
import { useI18n } from "../../i18n";
import type { PageRow } from "../../types";
import { useConsole } from "../../shell/context";
import { DataTable, Grid, SectionTitle, Stack, TextLink, Tile, TitleRow, type TileProps } from "../../ui";
import { LoadFailed } from "../work/LoadFailed";
import { PageContent } from "../work/PageContent";
import { StateChip } from "../work/StateChip";
import { useLoaded } from "../../shell/useLoaded";

const areaWords: Record<string, string> = { Network: "menuNetwork", Alerts: "opsAreaAlert" };

const shown = (value: unknown) => (typeof value === "string" ? value : "");

export function OperationsView() {
  const { hub } = useConsole();
  return <OperationsPage key={hub.id} hubId={hub.id} room={hub.manager_room_id} networkShown={showsPage(kindOf(hub), "network")} />;
}

type PageProps = { hubId: string; room: string | undefined; networkShown: boolean };

function OperationsPage({ hubId, room, networkShown }: PageProps) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(async () => overviewOf(await operationsPage.rows(hubId, room ? { room } : {})), [hubId, room]);

  const networkTile = ({ devices }: Overview): Omit<TileProps, "label"> => {
    const faults = devices.total - devices.online;
    const to = hubPath(hubId, "network");
    if (devices.total === 0) return { value: t("opsNetworkNone"), state: "mute", to };
    if (faults === 1) return { value: t("opsNetworkFaultOne"), state: "bad", to };
    if (faults > 1) return { value: t("opsNetworkFault").replace("{n}", String(faults)), state: "bad", to };
    if (devices.total === 1) return { value: t("opsNetworkUpOne"), state: "ok", to };
    return { value: t("opsNetworkUp").replace("{n}", String(devices.total)), state: "ok", to };
  };

  const agentsTile = ({ roles }: Overview): Omit<TileProps, "label"> => ({
    value: t("opsAgentsAvailable").replace("{on}", String(roles.on)).replace("{total}", String(roles.total)),
    state: roles.total > 0 && roles.on === roles.total ? "ok" : "mute",
    to: hubPath(hubId, "activity"),
  });

  const alertsTile = ({ alerts }: Overview): Omit<TileProps, "label"> => ({
    value: alerts === 0 ? t("opsAlertsNone") : t("opsAlertsOpen").replace("{n}", String(alerts)),
    state: alerts === 0 ? "ok" : "bad",
    to: hubPath(hubId, "alerts"),
  });

  const openLink = (row: PageRow) => {
    const network = shown(row.area) === "Network";
    if (network && !networkShown) return undefined;
    return (
      <TextLink to={hubPath(hubId, network ? "network" : "alerts")} arrow size="sm">
        {t("rowOpen")}
      </TextLink>
    );
  };

  const attentionRows = ({ attention }: Overview) =>
    attention.map((row, index) => ({
      key: `${shown(row.id)}/${index}`,
      cells: [
        t(areaWords[shown(row.area)] ?? "opsAreaAlert"),
        shown(row.area) === "Network" ? t("opsDeviceFault").replace("{device}", shown(row.detail)) : shown(row.detail),
        <StateChip key="state" state={shown(row.state)} />,
      ],
      actions: openLink(row),
    }));

  return (
    <>
      <TitleRow title={t("menu.operations")} />
      <PageContent>
        {state.kind === "failed" ? <LoadFailed onRetry={reload} /> : null}
        {state.kind === "ready" ? (
          <Stack gap={20}>
            <Grid min={13}>
              {networkShown ? <Tile label={t("menuNetwork")} {...networkTile(state.value)} /> : null}
              <Tile label={t("menuAgents")} {...agentsTile(state.value)} />
              <Tile label={t("menuAlerts")} {...alertsTile(state.value)} />
            </Grid>
            <SectionTitle title={t("opsNeedsAttention")} />
            <DataTable
              columns={[t("opsArea"), t("opsWhat"), t("colState")]}
              rows={attentionRows(state.value)}
              empty={t("opsNothingAttention")}
            />
          </Stack>
        ) : null}
      </PageContent>
    </>
  );
}
