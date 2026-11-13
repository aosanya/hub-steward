import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasModule, mcpAgencyClient, taskModule, type AgencyClient } from "../agency/modules";
import { openAgencyId } from "../agency/open";
import { askMayRead } from "../backlogs/access";
import { allIssuesId, mcpBacklogsClient, type Backlog, type BacklogsClient } from "../backlogs/api";
import { boardPath } from "../backlogs/paths";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useLoad } from "../forms/useLoad";
import { mcpStepsClient, type StepsClient } from "../steps/api";
import { smartBacklogPath } from "../smartBacklog/paths";
import { backlogsTab, ongoingTab, startTab, tabPathIn, type Tab } from "../tabs";
import { Icon } from "../ui/Icon";
import { ListRow, Rows } from "../ui/ListRow";
import { LoadFailed } from "../ui/LoadState";
import { lastBacklogId, rememberBacklog } from "./lastBacklog";

type Props = {
  agency?: AgencyClient;
  start?: Pick<StartClient, "openSteps">;
  steps?: Pick<StepsClient, "available">;
  backlogs?: Pick<BacklogsClient, "backlogs">;
  mayRead?: () => Promise<boolean>;
};

const holdsWorkflows = async (start: Props["start"] & {}, steps: Props["steps"] & {}) => {
  const reads = await Promise.allSettled([start.openSteps(), steps.available()]);
  const held = reads.some((read) => read.status === "fulfilled" && read.value.length > 0);
  if (!held && reads.some((read) => read.status === "rejected")) throw new Error("workflows unread");
  return held;
};

const visibleBacklogs = async (agency: AgencyClient, backlogs: Props["backlogs"] & {}, mayRead: Props["mayRead"] & {}): Promise<Backlog[]> => {
  const view = await agency.read();
  if (view.modulesUnread) throw new Error("modules unread");
  if (!hasModule(view, taskModule)) return [];
  return (await mayRead()) ? backlogs.backlogs() : [];
};

const lastOpenedFirst = (rows: Backlog[]) => {
  const last = lastBacklogId();
  return [...rows.filter((row) => row.id === last), ...rows.filter((row) => row.id !== last)];
};

const pathOf = (row: Backlog) => (row.kind === "smart" ? smartBacklogPath(row.id) : boardPath(row.id));

export function HomeOptions({ agency = mcpAgencyClient, start = mcpStartClient, steps = mcpStepsClient, backlogs = mcpBacklogsClient, mayRead = askMayRead }: Props) {
  const navigate = useNavigate();
  const agencyId = openAgencyId();
  const [attempt, setAttempt] = useState(0);
  const workflows = useLoad(() => holdsWorkflows(start, steps), `home-workflows:${agencyId}:${attempt}`);
  const held = useLoad(() => visibleBacklogs(agency, backlogs, mayRead), `home-backlogs:${agencyId}:${attempt}`);
  const retry = () => setAttempt(attempt + 1);
  if (workflows.state === "loading" || held.state === "loading") return null;
  const hasWorkflows = workflows.state === "ready" && workflows.data;
  const rows = held.state === "ready" ? held.data.filter((row) => row.id !== allIssuesId) : [];
  const options: Tab[] = [...(hasWorkflows ? [startTab, ongoingTab] : []), ...(hasWorkflows && rows.length > 0 ? [backlogsTab] : [])];
  const failedWords = [workflows.state === "error" ? "Start and Ongoing" : "", held.state === "error" ? "Backlogs" : ""].filter(Boolean).join(" and ");
  const failures = failedWords ? <LoadFailed words={`${failedWords} could not be loaded.`} onRetry={retry} /> : null;
  if (!hasWorkflows && rows.length > 0) {
    return (
      <>
        <Rows>
          {lastOpenedFirst(rows).map((row) => (
            <ListRow
              key={row.id}
              title={row.name}
              start={<span className="mark" aria-hidden="true"><Icon name={backlogsTab.icon} /></span>}
              end="›"
              onClick={() => {
                rememberBacklog(row.id);
                navigate(pathOf(row));
              }}
            />
          ))}
        </Rows>
        {failures}
      </>
    );
  }
  if (options.length === 0) return failures;
  return (
    <>
      <Rows>
        {options.map((tab) => (
          <ListRow
            key={tab.id}
            title={tab.label}
            start={<span className="mark" aria-hidden="true"><Icon name={tab.icon} /></span>}
            end="›"
            onClick={() => navigate(tabPathIn(tab, agencyId))}
          />
        ))}
      </Rows>
      {failures}
    </>
  );
}
