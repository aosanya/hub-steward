import { useState } from "react";
import { useI18n } from "../../i18n";
import { Button, Detail, Empty, Stack } from "../../ui";
import { GroupBoundary } from "../groups/GroupBoundary";
import { JoinModeForm } from "./groupsJoinMode";
import { AiRoleChip, JoinChip } from "./groupsTable";
import { rowsOf } from "./usersLoad";
import { useLoaded } from "../../shell/useLoaded";
import { PendingNote } from "./usersParts";
import { groupLine, userLine, type GroupLine } from "./usersRead";
import { UsersTable } from "./usersTable";
import type { Outcome } from "./sendAction";

type GroupDetailProps = { hubId: string; group: GroupLine; onChanged: () => void };

export function GroupDetail({ hubId, group, onChanged }: GroupDetailProps) {
  const { t } = useI18n();
  const { state } = useLoaded(async () => (await rowsOf("users", hubId, { group: group.id })).map(userLine).map((line) => ({ ...line, roles: line.roles.filter((seat) => seat.group === group.name) })), [hubId, group.id]);
  const card = useLoaded(async () => (await rowsOf("groups", hubId, { card: group.id })).map(groupLine)[0], [hubId, group.id]);
  const [changing, setChanging] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const storedMode = card.state.kind === "ready" ? card.state.value?.mode : "";
  const current: GroupLine = { ...group, mode: storedMode || group.mode };

  const changed = (result: Outcome) => {
    setChanging(false);
    setWaiting(result === "accepted");
    if (result === "done") {
      card.reload();
      onChanged();
    }
  };
  const change = () => {
    setWaiting(false);
    setChanging(true);
  };

  const count = state.kind === "ready" ? String(state.value.length) : String(group.members);

  return (
    <Stack>
      {waiting ? <PendingNote /> : null}
      <Detail
        title={t("groups.card")}
        actions={
          <Button kind="quiet" size="sm" onClick={change}>
            {t("groups.changeJoinMode")}
          </Button>
        }
        pairs={[
          [t("groups.colMembers"), count],
          [t("groups.colJoinMode"), <JoinChip mode={current.mode} />],
          [t("groups.colAiRole"), <AiRoleChip hubId={hubId} name={group.aiRole} />],
        ]}
      />
      {changing ? <JoinModeForm hubId={hubId} group={current} onOutcome={changed} onCancel={() => setChanging(false)} /> : null}
      <GroupBoundary hubId={hubId} groupId={group.id} />
      {state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}
      {state.kind === "ready" ? <UsersTable hubId={hubId} lines={state.value} asMembers /> : null}
    </Stack>
  );
}
