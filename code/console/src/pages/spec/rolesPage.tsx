import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { byName, matching } from "../../data/listView";
import { unlinkedAgents } from "../../data/pages/roles";
import { useI18n } from "../../i18n";
import { Empty, FilterBar, Stack, TitleRow } from "../../ui";
import { AddRoleForm } from "./rolesAdd";
import { RoleDetail } from "./rolesDetail";
import { EditRoleForm } from "./rolesEdit";
import { RolesCards } from "./rolesTable";
import { UnlinkedAgents } from "./rolesUnlinked";
import type { Outcome } from "./sendAction";
import { rowsOf } from "./usersLoad";
import { useLoaded } from "../../shell/useLoaded";
import { PendingNote } from "./usersParts";
import { roleLine, type RoleLine } from "./usersRead";

const types = ["human", "ai"] as const;

const narrowed = (lines: RoleLine[], search: string, type: string): RoleLine[] =>
  byName(
    matching(lines, (line) => [line.name, line.description], search).filter((line) => !type || line.ai === (type === "ai")),
    (line) => line.name,
  );

export function RolesPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const openId = params.get("open");
  const { state, reload } = useLoaded(async () => {
    const [rows, unlinked] = await Promise.all([rowsOf("roles", hubId), unlinkedAgents(hubId).catch(() => [])]);
    return { lines: rows.map(roleLine), unlinked };
  }, [hubId]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const add = () => {
    setWaiting(false);
    setAdding(true);
  };
  const added = (result: Outcome) => {
    setAdding(false);
    setWaiting(result === "accepted");
    if (result === "done") reload();
  };

  const edit = () => {
    setWaiting(false);
    setEditing(true);
  };
  const edited = (result: Outcome) => {
    setEditing(false);
    setWaiting(result === "accepted");
    if (result === "done") {
      reload();
      setEdits((count) => count + 1);
    }
  };
  const removed = (result: Outcome) => {
    setWaiting(result === "accepted");
    setParams({});
    reload();
  };

  if (state.kind === "loading") return <TitleRow title={t("menu.roles")} primary={openId ? undefined : t("roles.add")} onPrimary={add} />;

  if (openId) {
    const line = state.kind === "ready" ? state.value.lines.find((candidate) => candidate.id === openId) : undefined;
    return (
      <>
        <TitleRow title={line?.name ?? t("menu.roles")} primary={line && !editing ? t("roles.edit") : undefined} onPrimary={edit} />
        <div className="content">
          <Stack gap={20}>
            {waiting ? <PendingNote /> : null}
            {line && editing ? <EditRoleForm hubId={hubId} line={line} onOutcome={edited} onCancel={() => setEditing(false)} /> : null}
            {line ? (
              <RoleDetail key={edits} hubId={hubId} roleId={line.id} name={line.name} ai={line.ai} onRemoved={removed} />
            ) : (
              <Empty text={t(state.kind === "ready" ? "noRows" : "loadFailed")} failed={state.kind === "failed"} />
            )}
          </Stack>
        </div>
      </>
    );
  }

  return (
    <>
      <TitleRow title={t("menu.roles")} primary={t("roles.add")} onPrimary={add} />
      <div className="content">
        <Stack gap={20}>
          {waiting ? <PendingNote /> : null}
          {adding ? <AddRoleForm hubId={hubId} onOutcome={added} onCancel={() => setAdding(false)} /> : null}
          {state.kind === "failed" ? (
            <Empty text={t("loadFailed")} failed />
          ) : (
            <>
              <FilterBar
                placeholder={t("roles.search")}
                chips={[]}
                search={search}
                onSearch={setSearch}
                selects={[
                  {
                    icon: "filter",
                    label: t("roles.allTypes"),
                    value: type,
                    options: [
                      { value: "", label: t("roles.allTypes") },
                      ...types.map((kind) => ({ value: kind, label: t(kind === "ai" ? "roles.typeAi" : "roles.typeHuman") })),
                    ],
                    onChange: setType,
                  },
                ]}
              />
              <RolesCards hubId={hubId} lines={narrowed(state.value.lines, search, type)} />
              <UnlinkedAgents hubId={hubId} agents={state.value.unlinked} />
            </>
          )}
        </Stack>
      </div>
    </>
  );
}
