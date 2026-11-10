import { useNavigate, useParams } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { backlogAccessPath } from "../backlogAccess/paths";
import { editBacklogPath, useMayManage, type BacklogManageClient } from "../backlogManage";
import { mcpBacklogManageClient } from "../backlogManage/api";
import { issuesPath } from "../backlogs/paths";
import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { SectionHeading } from "../ui/SectionHeading";
import { Shell } from "../ui/Shell";
import { issuesWords } from "../backlogs/tags";
import { mcpBacklogPageClient, type BacklogPageClient } from "./api";

const stepsWords = (count: number) => `Backlog · ${count} ${count === 1 ? "step" : "steps"}`;

type Props = { client?: BacklogPageClient; manage?: BacklogManageClient };

export function BacklogPage({ client = mcpBacklogPageClient, manage = mcpBacklogManageClient }: Props) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const { backlogId = "" } = useParams();
  const loaded = useLoad(() => client.page(backlogId), `backlog-page:${openAgencyId()}:${backlogId}`);
  const mayManage = useMayManage(manage);
  const back = () => navigate(issuesPath(backlogId));

  if (loaded.state === "loading") {
    return (
      <Shell title="" onBack={back} backLabel={words.backList}>
        <LoadingLine />
      </Shell>
    );
  }
  if (loaded.state === "error" || !loaded.data) {
    return (
      <Shell title="" onBack={back} backLabel={words.backList}>
        <LoadFailed words="This could not be opened." />
      </Shell>
    );
  }

  const { name, steps, noStep, access } = loaded.data;
  return (
    <Shell title={name} sub={stepsWords(steps.length)} onBack={back} backLabel={words.backList}>
      {mayManage.state === "ready" && mayManage.data ? <Button to={editBacklogPath(backlogId)}>Edit this backlog</Button> : null}
      <SectionHeading>Steps, in order</SectionHeading>
      <Rows>
        {steps.map((step) => (
          <ListRow key={step.name} title={step.name} end={issuesWords(step.issues)} />
        ))}
        {noStep > 0 ? <ListRow key="no-step" title="No step" end={issuesWords(noStep)} /> : null}
      </Rows>
      {access ? (
        <>
          <SectionHeading>Who has access</SectionHeading>
          {access.restricted ? (
            <Rows>
              {access.groups.map((group) => (
                <ListRow key={group.name} title={group.name} end={<Chip tone={group.level === "Can see" ? undefined : "accent"}>{group.level}</Chip>} />
              ))}
            </Rows>
          ) : (
            <EmptyCard words="Nobody is restricted yet." />
          )}
          {access.restricted && access.groups.length === 1 ? <EmptyCard words="No other groups have access." /> : null}
        </>
      ) : null}
      {mayManage.state === "ready" && mayManage.data ? <Button to={backlogAccessPath(backlogId)}>Change who has access</Button> : null}
      <p className="sub">Change steps and access by asking in Chat. A group that can edit can also move and see.</p>
    </Shell>
  );
}
