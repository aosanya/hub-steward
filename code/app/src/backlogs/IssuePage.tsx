import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { SectionHeading } from "../ui/SectionHeading";
import { Shell } from "../ui/Shell";
import "./backlogs.css";
import { mcpBacklogsClient, type BacklogsClient } from "./api";
import { issuePath, issuesPath } from "./paths";

export function IssuePage({ client = mcpBacklogsClient }: { client?: BacklogsClient }) {
  const navigate = useNavigate();
  const id = useParams().issueId ?? "";
  const issue = useLoad(() => client.issue(id), `issue:${openAgencyId()}:${id}`);
  const ready = issue.state === "ready" ? issue.data : null;
  const place = ready ? [ready.backlog, ready.step].filter((part) => part !== "").join(" · ") : undefined;
  return (
    <Shell title={ready?.title ?? "Issue"} sub={place} onBack={() => navigate(issuesPath())}>
      {issue.state === "loading" ? <LoadingLine /> : null}
      {issue.state === "error" ? <LoadFailed words="This issue could not be loaded." /> : null}
      {ready?.description ? <p className="issue-body">{ready.description}</p> : null}
      {ready && ready.waitsOn.length > 0 ? (
        <>
          <SectionHeading>Waits on</SectionHeading>
          <Rows>
            {ready.waitsOn.map((one) => (
              <ListRow key={one.id} title={one.title || one.id} end="›" onClick={() => navigate(issuePath(one.id))} />
            ))}
          </Rows>
        </>
      ) : null}
    </Shell>
  );
}
