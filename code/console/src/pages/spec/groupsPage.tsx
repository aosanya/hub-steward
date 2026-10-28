import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { byName, matching } from "../../data/listView";
import { useI18n } from "../../i18n";
import { Empty, FilterBar, Stack, TitleRow } from "../../ui";
import { CreateGroupForm } from "./groupsCreate";
import { GroupDetail } from "./groupsDetail";
import { GroupsCards } from "./groupsTable";
import type { Outcome } from "./sendAction";
import { rowsOf } from "./usersLoad";
import { useLoaded } from "../../shell/useLoaded";
import { PendingNote } from "./usersParts";
import { groupLine } from "./usersRead";

export function GroupsPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const openId = params.get("open");
  const { state, reload } = useLoaded(async () => (await rowsOf("groups", hubId)).map(groupLine), [hubId]);
  const [creating, setCreating] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [search, setSearch] = useState("");

  const create = () => {
    setWaiting(false);
    setCreating(true);
  };
  const created = (result: Outcome) => {
    setCreating(false);
    setWaiting(result === "accepted");
    if (result === "done") reload();
  };

  if (state.kind === "loading") return <TitleRow title={t("menu.groups")} primary={openId ? undefined : t("groups.create")} onPrimary={create} />;

  if (openId) {
    const group = state.kind === "ready" ? state.value.find((candidate) => candidate.id === openId) : undefined;
    return (
      <>
        <TitleRow title={group?.name ?? t("menu.groups")} />
        <div className="content">
          {group ? <GroupDetail hubId={hubId} group={group} onChanged={reload} /> : <Empty text={t(state.kind === "ready" ? "noRows" : "loadFailed")} failed={state.kind === "failed"} />}
        </div>
      </>
    );
  }

  return (
    <>
      <TitleRow title={t("menu.groups")} primary={t("groups.create")} onPrimary={create} />
      <div className="content">
        <Stack>
          {waiting ? <PendingNote /> : null}
          {creating ? <CreateGroupForm hubId={hubId} onOutcome={created} onCancel={() => setCreating(false)} /> : null}
          {state.kind === "failed" ? (
            <Empty text={t("loadFailed")} failed />
          ) : (
            <>
              <FilterBar placeholder={t("groups.search")} chips={[]} search={search} onSearch={setSearch} />
              <GroupsCards
                hubId={hubId}
                lines={byName(
                  matching(state.value, (line) => [line.name, line.aiRole], search),
                  (line) => line.name,
                )}
              />
            </>
          )}
        </Stack>
      </div>
    </>
  );
}
