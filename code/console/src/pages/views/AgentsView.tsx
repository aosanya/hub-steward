import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hubPath } from "../../api";
import { byName, matching } from "../../data/listView";
import { agentsPage, createAgentForSeat, idOf, text } from "../../data/pages/agents";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import type { PageRow } from "../../types";
import { Card, Chip, Detail, Empty, FilterBar, Stack, TextLink, TitleRow, type ChipKind } from "../../ui";
import { modelFriendlyName } from "../models/catalog";
import { useLoaded } from "../../shell/useLoaded";

type StateLook = { label: string; kind: ChipKind };

const stateLooks: Record<string, StateLook> = {
  Running: { label: "agents.state.running", kind: "ok" },
  Skipped: { label: "agents.state.skipped", kind: "warn" },
  Stopped: { label: "agents.state.stopped", kind: "mute" },
  "Cannot speak": { label: "agents.state.cannotSpeak", kind: "warn" },
  "No model": { label: "agents.state.noModel", kind: "mute" },
};

const statesWithoutModel = ["Cannot speak", "No model"];

type RowParts = { row: PageRow; hubId: string; t: (key: string) => string };

const editPath = ({ row, hubId }: RowParts) =>
  typeof row.edit === "string" ? hubPath(hubId, row.edit, idOf(row) ?? "", "model") : undefined;

function ModelChip({ row, hubId, t }: RowParts) {
  const none = statesWithoutModel.includes(text(row.state)) || text(row.model) === "";
  return (
    <Link to={hubPath(hubId, "models")}>
      <Chip kind="mute">{none ? t("agents.noModelKey") : modelFriendlyName(text(row.model))}</Chip>
    </Link>
  );
}

function StateChip({ row, hubId, t }: RowParts) {
  const state = text(row.state);
  const look = stateLooks[state];
  const chip = <Chip kind={look?.kind ?? "mute"}>{look ? t(look.label) : state}</Chip>;
  return typeof row.link === "string" ? <Link to={hubPath(hubId, row.link)}>{chip}</Link> : chip;
}

function ConfigureAction({ row, hubId, t }: RowParts) {
  const navigate = useNavigate();
  const to = editPath({ row, hubId, t });
  const seatId = text(row.seat_id);
  const [failed, setFailed] = useState(false);
  if (to) return <TextLink to={to} size="sm">{t("agents.configure")}</TextLink>;
  if (seatId === "") return null;
  const open = async () => {
    try {
      const id = await createAgentForSeat(hubId, seatId, text(row.name), text(row.description));
      navigate(hubPath(hubId, "agent-edit", id, "model"));
    } catch {
      setFailed(true);
    }
  };
  return (
    <TextLink onClick={open} size="sm">
      {failed ? t("loadFailed") : t("agents.configure")}
    </TextLink>
  );
}

function AgentCard({ row, hubId, t }: RowParts) {
  const [open, setOpen] = useState(false);
  return (
    <Card
      title={text(row.name)}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={<ConfigureAction row={row} hubId={hubId} t={t} />}
    >
      <Detail
        pairs={[
          [t("agents.worksFor"), text(row.works_for) || "—"],
          [t("agentModel"), <ModelChip row={row} hubId={hubId} t={t} />],
          [t("agents.colState"), <StateChip row={row} hubId={hubId} t={t} />],
        ]}
      />
    </Card>
  );
}

export function AgentsView() {
  const { hub } = useConsole();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const { state: agents } = useLoaded<PageRow[]>(() => agentsPage.rows(hub.id, {}), [hub.id]);

  const shown =
    agents.kind === "ready"
      ? byName(
          matching(agents.value, (row) => [text(row.name), text(row.works_for), text(row.model)], search),
          (row) => text(row.name),
        )
      : [];

  return (
    <>
      <TitleRow title={t("menu.agents")} />
      <div className="content">
        {agents.kind === "failed" ? <Empty failed text={t("loadFailed")} /> : null}
        {agents.kind === "ready" ? (
          <Stack gap={20}>
            <FilterBar placeholder={t("agents.search")} chips={[]} search={search} onSearch={setSearch} />
            {shown.length === 0 ? <Empty text={t("noRows")} /> : shown.map((row) => <AgentCard key={idOf(row) ?? (text(row.seat_id) || text(row.name))} row={row} hubId={hub.id} t={t} />)}
          </Stack>
        ) : null}
      </div>
    </>
  );
}
