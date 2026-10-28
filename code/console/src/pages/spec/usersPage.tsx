import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { byName } from "../../data/listView";
import { filterUserRows, usersWithWaiting, type UserRow } from "../../data/pages/users";
import { useI18n } from "../../i18n";
import { Empty, FilterBar, Stack, TitleRow } from "../../ui";
import type { Outcome } from "./sendAction";
import { InviteForm } from "./usersInvite";
import { useLoaded } from "../../shell/useLoaded";
import { UserDetail } from "./usersDetail";
import { PendingNote } from "./usersParts";
import { userLine, type UserLine } from "./usersRead";
import { UsersCards } from "./usersCards";
import { UsersWaiting } from "./usersWaiting";

type UsersPageProps = { hubId: string };

const asRows = (lines: UserLine[]): UserRow[] =>
  lines.map((line) => ({ id: line.id, member_code: line.code, user: line.name, groups: line.groups, roles: line.roles, access: "member", joined: line.joined }));

const narrowed = (lines: UserLine[], search: string, role: string): UserLine[] => {
  const kept = new Set(filterUserRows(asRows(lines), { search, role }).map((row) => row.id));
  return byName(
    lines.filter((line) => kept.has(line.id)),
    (line) => line.name,
  );
};

export function UsersPage({ hubId }: UsersPageProps) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const openId = params.get("open");
  const { state, reload } = useLoaded(async () => {
    const read = await usersWithWaiting(hubId);
    return { lines: read.rows.map((row) => userLine(row)), roleNames: read.roleNames, waiting: read.waiting, waitingFailed: read.waitingFailed };
  }, [hubId]);
  const [inviting, setInviting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");

  const invite = () => {
    setWaiting(false);
    setInviting(true);
  };
  const sent = (result: Outcome) => {
    setInviting(false);
    setWaiting(result === "accepted");
    if (result === "done") reload();
  };

  if (state.kind === "loading") return <TitleRow title={t("menu.users")} primary={openId ? undefined : t("users.invite")} onPrimary={invite} />;

  if (openId) {
    const line = state.kind === "ready" ? state.value.lines.find((candidate) => candidate.id === openId) : undefined;
    return (
      <>
        <TitleRow title={line?.name ?? t("menu.users")} />
        <div className="content">{line ? <UserDetail hubId={hubId} line={line} /> : <Empty text={t(state.kind === "ready" ? "noRows" : "loadFailed")} failed={state.kind === "failed"} />}</div>
      </>
    );
  }

  return (
    <>
      <TitleRow title={t("menu.users")} primary={t("users.invite")} onPrimary={invite} />
      <div className="content">
        <Stack>
          {waiting ? <PendingNote /> : null}
          {state.kind === "ready" ? <UsersWaiting hubId={hubId} requests={state.value.waiting} onDecided={reload} /> : null}
          {state.kind === "ready" && state.value.waitingFailed ? <Empty text={t("loadFailed")} failed /> : null}
          {inviting ? <InviteForm hubId={hubId} onOutcome={sent} onCancel={() => setInviting(false)} /> : null}
          {state.kind === "failed" ? (
            <Empty text={t("loadFailed")} failed />
          ) : (
            <>
              <FilterBar
                placeholder={t("users.search")}
                chips={[]}
                search={search}
                onSearch={setSearch}
                selects={[
                  {
                    icon: "user",
                    label: t("users.allRoles"),
                    value: role,
                    options: [{ value: "", label: t("users.allRoles") }, ...state.value.roleNames.map((name) => ({ value: name, label: name }))],
                    onChange: setRole,
                  },
                ]}
              />
              <UsersCards hubId={hubId} lines={narrowed(state.value.lines, search, role)} />
            </>
          )}
        </Stack>
      </div>
    </>
  );
}
