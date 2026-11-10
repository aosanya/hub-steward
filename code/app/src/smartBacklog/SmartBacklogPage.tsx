import "./smartBacklog.css";
import { useNavigate, useParams } from "react-router-dom";
import { mcpBacklogManageClient } from "../backlogManage/api";
import { useMayManage } from "../backlogManage/useMayManage";
import type { BacklogManageClient } from "../backlogManage/types";
import { mcpBacklogsClient, type BacklogsClient } from "../backlogs/api";
import { IssueRow } from "../backlogs/IssueRow";
import { backlogsHomePath, issuePath } from "../backlogs/paths";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { mcpSmartBacklogClient } from "./api";
import { editRulesPath } from "./paths";
import type { SmartBacklogClient } from "./types";
import { rulesWords } from "./words";

type Props = { client?: SmartBacklogClient; issues?: BacklogsClient; manage?: BacklogManageClient };

export function SmartBacklogPage({ client = mcpSmartBacklogClient, issues = mcpBacklogsClient, manage = mcpBacklogManageClient }: Props) {
  const navigate = useNavigate();
  const backlogId = useParams().backlogId ?? "";
  const loaded = useLoad(async () => ({ backlog: await client.read(backlogId), rows: await issues.issues(backlogId) }), `smart:${openAgencyId()}:${backlogId}`);
  const may = useMayManage(manage);
  const mayEdit = may.state === "ready" && may.data;
  const back = () => navigate(backlogsHomePath());
  if (loaded.state === "loading") return <Shell title="Backlog" onBack={back}><LoadingLine /></Shell>;
  if (loaded.state === "error") return <Shell title="Backlog" onBack={back}><LoadFailed words="This smart backlog could not be loaded." /></Shell>;
  const { backlog, rows } = loaded.data;
  const edit = () => navigate(editRulesPath(backlogId));
  return (
    <Shell title={backlog.name} onBack={back}>
      <div className="smart-head">
        <Chip tone="info">Smart</Chip>
        <span className="sub">{rulesWords(backlog.set)}</span>
      </div>
      {mayEdit ? <Button onClick={edit}>Edit rules</Button> : null}
      {rows.length === 0 ? (
        <EmptyCard words="Nothing matches yet">{mayEdit ? <Button kind="primary" onClick={edit}>Edit rules</Button> : null}</EmptyCard>
      ) : (
        <>
          <p className="sub count">{rows.length === 1 ? "1 issue" : `${rows.length} issues`}</p>
          <Rows>
            {rows.map((issue) => (
              <IssueRow key={issue.id} issue={issue} chosen={[]} onOpen={() => navigate(issuePath(issue.id))} chevron />
            ))}
          </Rows>
        </>
      )}
    </Shell>
  );
}
