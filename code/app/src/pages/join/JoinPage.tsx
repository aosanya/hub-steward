import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinGroupWorkflow } from "../../home/workflowScreens";
import { mcpGroupsClient, type GroupsClient, type JoinableGroup, type MyGroup } from "../../groups/api";
import { Button } from "../../ui/Button";
import { EmptyCard } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { ListRow, Rows } from "../../ui/ListRow";
import { chatListPath, doSomethingPath, routes } from "../../routes";
import { Shell } from "../../ui/Shell";

const defaultClient = mcpGroupsClient();

export function JoinPage({ client = defaultClient }: { client?: GroupsClient }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<JoinableGroup[]>([]);
  const [mine, setMine] = useState<MyGroup[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [code, setCode] = useState("");
  const [found, setFound] = useState<JoinableGroup | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([client.listJoinableGroups(), client.listMyJoinRequests(), client.listMyGroups().catch(() => [])])
      .then(([list, asked, member]) => {
        if (!live) return;
        setGroups(list);
        setRequested(new Set(asked.filter((r) => r.state === "pending").map((r) => r.groupId)));
        setMine(member);
      })
      .catch(() => live && setFailed(true))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [client]);

  const find = async () => {
    setFailed(false);
    setNotFound(false);
    setFound(null);
    try {
      const group = await client.findGroupByCode(code.trim());
      if (group) setFound(group);
      else setNotFound(true);
    } catch {
      setFailed(true);
    }
  };

  const join = async (group: JoinableGroup) => {
    setFailed(false);
    try {
      const outcome = await client.joinGroup(group.id);
      if (outcome.state === "joined") {
        setMine((prev) => (prev.some((m) => m.id === group.id) ? prev : [...prev, { id: group.id, name: group.name }]));
      } else {
        setRequested((prev) => new Set(prev).add(group.id));
      }
    } catch {
      setFailed(true);
    }
  };

  const memberIds = new Set(mine.map((group) => group.id));
  const stillToJoin = groups.filter((group) => !memberIds.has(group.id));

  const memberRow = (group: MyGroup) => (
    <ListRow
      key={group.id}
      title={group.name}
      lead
      meta="You are in"
      onClick={() => navigate(routes.roomThreads.path({ roomId: group.id }))}
    />
  );

  const row = (group: JoinableGroup) =>
    memberIds.has(group.id) ? (
      memberRow(group)
    ) : (
      <ListRow
        key={group.id}
        title={group.name}
        lead
        code={group.code}
        meta={group.approvalNeeded ? "Approval needed" : undefined}
        end={
          requested.has(group.id) ? (
            <Button disabled>Requested</Button>
          ) : (
            <Button onClick={() => join(group)}>{group.approvalNeeded ? "Ask to join" : "Join"}</Button>
          )
        }
      />
    );

  return (
    <Shell title={joinGroupWorkflow} onBack={() => navigate(doSomethingPath())}>
      <Field
        label="Have a group code?"
        placeholder="G-XXX-XXX-XXX"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={notFound ? "No group has that code" : undefined}
      />
      <Button onClick={find} disabled={code.trim() === ""}>
        Find
      </Button>
      {failed ? <p role="alert">Something went wrong. Try again.</p> : null}
      {found && !memberIds.has(found.id) ? <Rows>{row(found)}</Rows> : null}
      {mine.length > 0 ? <Rows>{mine.map(memberRow)}</Rows> : null}
      {loaded && !failed && groups.length === 0 && mine.length === 0 ? (
        <EmptyCard words="No groups are open to join yet." />
      ) : (
        <Rows>{stillToJoin.map(row)}</Rows>
      )}
      {requested.size > 0 || mine.length > 0 ? (
        <Button kind="primary" onClick={() => navigate(chatListPath())}>
          Go to Chat
        </Button>
      ) : null}
    </Shell>
  );
}
