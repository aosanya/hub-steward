import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { mcpBacklogManageClient } from "../backlogManage/api";
import type { BacklogManageClient } from "../backlogManage/types";
import { useMayManage } from "../backlogManage/useMayManage";
import { backlogPagePath } from "../backlogPage/paths";
import { useLoad } from "../forms/useLoad";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { Segmented } from "../ui/Segmented";
import { Shell } from "../ui/Shell";
import { mcpBacklogAccessClient } from "./api";
import { groupsWithoutAccess, levelItems, levelWords, rowsOf, withGroup, withLevel, withoutGroup } from "./levels";
import { refusalWords, type AccessRow, type AgencyGroup, type BacklogAccessClient, type ChoiceLevel } from "./types";

type FormProps = { client: BacklogAccessClient; backlogId: string; first: AccessRow[]; groups: AgencyGroup[] };

function Form({ client, backlogId, first, groups }: FormProps) {
  const [rows, setRows] = useState(first);
  const [choosing, setChoosing] = useState(false);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const others = groupsWithoutAccess(groups, rows);

  const attempt = async (act: () => Promise<void>, done: () => void) => {
    setBusy(true);
    setProblem("");
    try {
      await act();
      done();
    } catch (error) {
      setProblem(refusalWords(error, "The access could not be changed. Try again."));
    }
    setBusy(false);
  };

  const choose = (row: AccessRow, level: ChoiceLevel) =>
    level === "none"
      ? attempt(() => client.remove(backlogId, row.groupId), () => setRows((now) => withoutGroup(now, row.groupId)))
      : attempt(() => client.set(backlogId, row.groupId, level), () => setRows((now) => withLevel(now, row.groupId, level)));

  const add = (group: AgencyGroup) =>
    attempt(() => client.set(backlogId, group.id, "see"), () => {
      setRows((now) => withGroup(now, group));
      setChoosing(false);
    });

  return (
    <>
      {rows.map((row) => (
        <Card key={row.groupId}>
          <span className="ttl">{row.name}</span>
          {row.fixed ? <Chip tone="accent">{levelWords("move")}</Chip> : <Segmented items={levelItems} current={row.level} onChange={(level) => !busy && choose(row, level)} />}
        </Card>
      ))}
      {problem ? <p className="ferr" role="alert">{problem}</p> : null}
      {choosing ? (
        others.length === 0 ? (
          <EmptyCard words="Every group already has access." />
        ) : (
          <Rows>
            {others.map((group) => (
              <ListRow key={group.id} title={group.name} onClick={() => !busy && add(group)} />
            ))}
          </Rows>
        )
      ) : (
        <Button onClick={() => setChoosing(true)} disabled={busy}>
          Add a group
        </Button>
      )}
      <p className="sub">Access is given to groups, to the whole backlog. The Product owner group always has Can move. A group that can move issues can also see them.</p>
    </>
  );
}

type Props = { client?: BacklogAccessClient; manage?: BacklogManageClient };

export function BacklogAccessScreen({ client = mcpBacklogAccessClient, manage = mcpBacklogManageClient }: Props) {
  const navigate = useNavigate();
  const { backlogId = "" } = useParams();
  const may = useMayManage(manage);
  const loaded = useLoad(
    () => Promise.all([manage.read(backlogId), client.read(backlogId), client.groups()]),
    `backlog-access:${openAgencyId()}:${backlogId}`,
  );
  const name = loaded.state === "ready" ? loaded.data[0].name : "";
  return (
    <Shell title={name ? `Access to ${name}` : "Access to a backlog"} sub="Backlog" onBack={() => navigate(backlogPagePath(backlogId))}>
      {may.state === "loading" || loaded.state === "loading" ? <LoadingLine /> : null}
      {may.state === "error" || loaded.state === "error" ? <LoadFailed words="The access could not be loaded." /> : null}
      {may.state === "ready" && !may.data ? <EmptyCard words="Your role cannot change who has access to backlogs." /> : null}
      {may.state === "ready" && may.data && loaded.state === "ready" ? (
        <Form client={client} backlogId={backlogId} first={rowsOf(loaded.data[1], loaded.data[2])} groups={loaded.data[2]} />
      ) : null}
    </Shell>
  );
}
