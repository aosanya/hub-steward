import { useNavigate, useParams } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { issuesPath } from "../backlogs/paths";
import { useLoad } from "../forms/useLoad";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { SectionHeading } from "../ui/SectionHeading";
import { Shell } from "../ui/Shell";
import { mcpBacklogPageClient, type BacklogPageClient } from "./api";

const issuesWords = (count: number) => `${count} ${count === 1 ? "issue" : "issues"}`;

const stepsWords = (count: number) => `Backlog · ${count} ${count === 1 ? "step" : "steps"}`;

export function BacklogPage({ client = mcpBacklogPageClient }: { client?: BacklogPageClient }) {
  const navigate = useNavigate();
  const { backlogId = "" } = useParams();
  const loaded = useLoad(() => client.page(backlogId), `backlog-page:${openAgencyId()}:${backlogId}`);
  const back = () => navigate(issuesPath(backlogId));

  if (loaded.state === "loading") {
    return (
      <Shell title="" onBack={back}>
        <LoadingLine />
      </Shell>
    );
  }
  if (loaded.state === "error" || !loaded.data) {
    return (
      <Shell title="" onBack={back}>
        <LoadFailed words="This could not be opened." />
      </Shell>
    );
  }

  const { name, steps, groups } = loaded.data;
  return (
    <Shell title={name} sub={stepsWords(steps.length)} onBack={back}>
      <SectionHeading>Steps, in order</SectionHeading>
      <Rows>
        {steps.map((step) => (
          <ListRow key={step.name} title={step.name} end={issuesWords(step.issues)} />
        ))}
      </Rows>
      <SectionHeading>Who has access</SectionHeading>
      <Rows>
        {groups.map((group) => (
          <ListRow key={group.name} title={group.name} end={<Chip tone={group.level === "Can move" ? "accent" : undefined}>{group.level}</Chip>} />
        ))}
      </Rows>
      {groups.length === 1 ? <EmptyCard words="No other groups have access." /> : null}
      <p className="sub">Change steps and access by asking in Chat. A group that can move issues can also see them.</p>
    </Shell>
  );
}
