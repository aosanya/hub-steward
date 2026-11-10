import "../backlogManage/backlogManage.css";
import { useEffect, useState, type ReactNode } from "react";
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
import { groupsOfOwnerHierarchy, groupsWithoutAccess, levelItems, levelWords, smartLevelItems, noRoleWords, rowsOf, withGroup, withLevel, withoutGroup } from "./levels";
import { refusalWords, type AccessLevel, type AccessRow, type AgencyGroup, type BacklogAccessClient } from "./types";

type FormProps = { client: BacklogAccessClient; backlogId: string; first: AccessRow[]; firstOwner: string; groups: AgencyGroup[]; smart: boolean };

function Form({ client, backlogId, first, firstOwner, groups, smart }: FormProps) {
  const [rows, setRows] = useState(first);
  const [owner, setOwner] = useState(firstOwner);
  const [choosing, setChoosing] = useState(false);
  const [leaving, setLeaving] = useState<AccessRow | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const others = groupsWithoutAccess(groupsOfOwnerHierarchy(groups, owner), rows);

  const refresh = async () => {
    try {
      const reading = await client.read(backlogId);
      setOwner(reading.ownerGroup);
      setRows(rowsOf(reading, groups));
    } catch {
      return;
    }
  };

  const refreshRoles = async () => {
    try {
      const fresh = rowsOf(await client.read(backlogId), groups);
      setRows((now) =>
        now.map((row) => {
          const found = fresh.find((one) => one.groupId === row.groupId);
          return found ? { ...row, roleName: found.roleName, roleTooSmall: found.roleTooSmall } : row;
        }),
      );
    } catch {
      return;
    }
  };

  const attempt = async (act: () => Promise<void>, done: () => void) => {
    setBusy(true);
    setProblem("");
    try {
      await act();
      done();
      await refreshRoles();
    } catch (error) {
      setProblem(refusalWords(error, "The access could not be changed. Try again."));
      await refresh();
    }
    setBusy(false);
  };

  const choose = (row: AccessRow, level: AccessLevel) =>
    attempt(() => client.set(backlogId, row.groupId, level), () => setRows((now) => withLevel(now, row.groupId, level)));

  const takeAway = (row: AccessRow) => {
    setLeaving(null);
    return attempt(() => client.remove(backlogId, row.groupId), () => setRows((now) => withoutGroup(now, row.groupId)));
  };

  const add = (group: AgencyGroup) =>
    attempt(() => client.set(backlogId, group.id, "see"), () => {
      setRows((now) => withGroup(now, group));
      setChoosing(false);
    });

  const nameOwner = (group: AgencyGroup) =>
    attempt(() => client.setOwnerGroup(group.id), () => {
      setOwner(group.id);
      setRows((now) => [{ groupId: group.id, name: group.name, level: "edit", fixed: true, roleName: "", roleTooSmall: false }, ...now.filter((row) => row.groupId !== group.id)]);
    });

  return (
    <>
      {owner === "" ? (
        <Card>
          <p className="sub">Nobody is restricted yet: choose the Product owner group first.</p>
          <Rows>
            {groups.map((group) => (
              <ListRow key={group.id} title={group.name} onClick={() => !busy && nameOwner(group)} />
            ))}
          </Rows>
        </Card>
      ) : null}
      {rows.map((row) => (
        <Card key={row.groupId}>
          <div className="card-head">
            <span className="ttl">{row.name}</span>
            {row.fixed ? null : (
              <button type="button" className="icb" aria-label={`Take away access from ${row.name}`} disabled={busy} onClick={() => setLeaving(row)}>
                ×
              </button>
            )}
          </div>
          {row.fixed ? (
            <Chip tone="accent">{levelWords("edit")}</Chip>
          ) : (
            <Segmented items={smart ? smartLevelItems : levelItems} current={row.level} label={`Access for ${row.name}`} disabled={busy} onChange={(level) => choose(row, level)} />
          )}
          {row.fixed && row.roleName === "" ? null : <p className="sub">Uses the Backlogs as: {row.roleName === "" ? noRoleWords : row.roleName}</p>}
          {row.roleTooSmall ? <p className="ferr">This group's role is too small to move issues</p> : null}
        </Card>
      ))}
      {leaving ? (
        <Card>
          <p>Take away {leaving.name}?</p>
          <Button kind="danger" onClick={() => takeAway(leaving)} disabled={busy}>
            Take away
          </Button>
          <Button onClick={() => setLeaving(null)}>
            Cancel
          </Button>
        </Card>
      ) : null}
      {problem ? <p className="ferr" role="alert">{problem}</p> : null}
      {owner === "" ? null : choosing ? (
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
      <p className="sub">Access is given to groups, to the whole backlog. The Product owner group always has Can edit. {smart ? "A smart backlog has nothing to move, so a group can see it or edit it." : "A group that can edit can also move and see."}</p>
    </>
  );
}

type FrameProps = { title: string; backlogId: string; children: ReactNode };

function Frame({ title, backlogId, children }: FrameProps) {
  const navigate = useNavigate();
  return (
    <Shell title={title} sub="Backlog" onBack={() => navigate(backlogPagePath(backlogId))}>
      {children}
    </Shell>
  );
}

type LoadedProps = { client: BacklogAccessClient; manage: BacklogManageClient; backlogId: string; onName: (name: string) => void };

function Loaded({ client, manage, backlogId, onName }: LoadedProps) {
  const loaded = useLoad(
    () => Promise.all([manage.read(backlogId), client.read(backlogId), client.groups(), client.isSmart(backlogId)]),
    `backlog-access:${openAgencyId()}:${backlogId}`,
  );
  const name = loaded.state === "ready" ? loaded.data[0].name : "";
  useEffect(() => onName(name), [name]);
  return (
    <>
      {loaded.state === "loading" ? <LoadingLine /> : null}
      {loaded.state === "error" ? <LoadFailed words="The access could not be loaded." /> : null}
      {loaded.state === "ready" ? (
        <Form client={client} backlogId={backlogId} first={rowsOf(loaded.data[1], loaded.data[2])} firstOwner={loaded.data[1].ownerGroup} groups={loaded.data[2]} smart={loaded.data[3]} />
      ) : null}
    </>
  );
}

type Props = { client?: BacklogAccessClient; manage?: BacklogManageClient };

export function BacklogAccessScreen({ client = mcpBacklogAccessClient, manage = mcpBacklogManageClient }: Props) {
  const { backlogId = "" } = useParams();
  const [name, setName] = useState("");
  const may = useMayManage(manage);
  return (
    <Frame title={name ? `Access to ${name}` : "Access to a backlog"} backlogId={backlogId}>
      {may.state === "loading" ? <LoadingLine /> : null}
      {may.state === "error" ? <LoadFailed words="The access could not be loaded." /> : null}
      {may.state === "ready" && !may.data ? <EmptyCard words="Your role cannot change who has access to backlogs." /> : null}
      {may.state === "ready" && may.data ? <Loaded client={client} manage={manage} backlogId={backlogId} onName={setName} /> : null}
    </Frame>
  );
}
