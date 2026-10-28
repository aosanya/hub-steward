import type { ReactNode } from "react";
import { loadUserDetail } from "../../data/pages/usersDetail";
import { useI18n } from "../../i18n";
import { Detail, Empty, Stack } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { Dash, shortDate } from "./usersParts";
import type { UserLine } from "./usersRead";
import { GroupChips, RoleChips } from "./usersTable";
import { HoldsCard, TasksCard } from "./usersWork";

export function UserDetail({ hubId, line }: { hubId: string; line: UserLine }) {
  const { t, lang } = useI18n();
  const { state } = useLoaded(() => loadUserDetail(hubId, line.id), [hubId, line.id]);
  const read = state.kind === "ready" ? state.value : null;
  const code = read?.code || line.code;
  const joined = read?.joined || line.joined;
  const pairs: [string, ReactNode][] = [
    [t("users.colRole"), <RoleChips hubId={hubId} roles={line.roles} withGroup />],
    [t("users.colGroups"), <GroupChips groups={read ? read.groups : line.groups} />],
    [t("users.colJoined"), joined ? shortDate(joined, lang) : <Dash />],
    ...(code ? [[t("field.actor_code"), <span className="count">{code}</span>] as [string, ReactNode]] : []),
  ];
  return (
    <Stack>
      <Detail title={t("users.profile")} pairs={pairs} />
      {state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}
      {read ? <TasksCard tasks={read.tasks} /> : null}
      {read ? <HoldsCard holds={read.holds} /> : null}
    </Stack>
  );
}
