import { useNavigate } from "react-router-dom";
import { hasModule, mcpAgencyClient, taskModule, type AgencyClient } from "../agency/modules";
import { openAgencyId } from "../agency/open";
import { allIssuesId, mcpBacklogsClient, type Backlog, type BacklogsClient } from "../backlogs/api";
import { boardPath } from "../backlogs/paths";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useLoad } from "../forms/useLoad";
import { mcpStepsClient, type StepsClient } from "../steps/api";
import { smartBacklogPath } from "../smartBacklog/paths";
import { backlogsTab, ongoingTab, startTab, tabPathIn, type Tab } from "../tabs";
import { Icon } from "../ui/Icon";
import { ListRow, Rows } from "../ui/ListRow";
import { lastBacklogId, rememberBacklog } from "./lastBacklog";

type Props = {
  agency?: AgencyClient;
  start?: Pick<StartClient, "openSteps">;
  steps?: Pick<StepsClient, "available">;
  backlogs?: Pick<BacklogsClient, "backlogs">;
};

const none = <T,>(read: () => Promise<T[]>) => read().catch((): T[] => []);

const holdsWorkflows = async (start: Props["start"] & {}, steps: Props["steps"] & {}) => {
  const [open, available] = await Promise.all([none(() => start.openSteps()), none(() => steps.available())]);
  return open.length + available.length > 0;
};

const visibleBacklogs = async (agency: AgencyClient, backlogs: Props["backlogs"] & {}): Promise<Backlog[]> => {
  const view = await agency.read().catch(() => null);
  return hasModule(view, taskModule) ? none(() => backlogs.backlogs()) : [];
};

const lastOpenedFirst = (rows: Backlog[]) => {
  const last = lastBacklogId();
  return [...rows.filter((row) => row.id === last), ...rows.filter((row) => row.id !== last)];
};

const pathOf = (row: Backlog) => (row.kind === "smart" ? smartBacklogPath(row.id) : boardPath(row.id));

export function HomeOptions({ agency = mcpAgencyClient, start = mcpStartClient, steps = mcpStepsClient, backlogs = mcpBacklogsClient }: Props) {
  const navigate = useNavigate();
  const agencyId = openAgencyId();
  const workflows = useLoad(() => holdsWorkflows(start, steps), `home-workflows:${agencyId}`);
  const held = useLoad(() => visibleBacklogs(agency, backlogs), `home-backlogs:${agencyId}`);
  if (workflows.state === "loading" || held.state === "loading") return null;
  const hasWorkflows = workflows.state === "ready" && workflows.data;
  const rows = held.state === "ready" ? held.data.filter((row) => row.id !== allIssuesId) : [];
  const options: Tab[] = [...(hasWorkflows ? [startTab, ongoingTab] : []), ...(hasWorkflows && rows.length > 0 ? [backlogsTab] : [])];
  if (!hasWorkflows && rows.length > 0) {
    return (
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
    );
  }
  if (options.length === 0) return null;
  return (
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
  );
}
