import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasModule, mcpAgencyClient, taskModule, type AgencyClient } from "../agency/modules";
import { openAgencyId } from "../agency/open";
import { askMayRead } from "../backlogs/access";
import { allIssuesId, mcpBacklogsClient, type Backlog, type BacklogsClient } from "../backlogs/api";
import { mcpFilesClient, filesHomePath, type FilesClient } from "../files";
import { mcpStartClient, type StartClient } from "../market/start/api";
import { useLoad } from "../forms/useLoad";
import { mcpStepsClient, type StepsClient } from "../steps/api";
import { backlogsTab, ongoingTab, startTab, tabPathIn, type Tab } from "../tabs";
import { Icon } from "../shared/ui/Icon";
import { ListRow, Rows } from "../shared/ui/ListRow";
import { LoadFailed } from "../shared/ui/LoadState";

type Props = {
  agency?: AgencyClient;
  start?: Pick<StartClient, "openSteps">;
  steps?: Pick<StepsClient, "available">;
  backlogs?: Pick<BacklogsClient, "backlogs">;
  mayRead?: () => Promise<boolean>;
  files?: Pick<FilesClient, "mounted">;
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

export function HomeOptions({ agency = mcpAgencyClient, start = mcpStartClient, steps = mcpStepsClient, backlogs = mcpBacklogsClient, mayRead = askMayRead, files = mcpFilesClient }: Props) {
  const navigate = useNavigate();
  const agencyId = openAgencyId();
  const [attempt, setAttempt] = useState(0);
  const workflows = useLoad(() => holdsWorkflows(start, steps), `home-workflows:${agencyId}:${attempt}`);
  const held = useLoad(() => visibleBacklogs(agency, backlogs, mayRead), `home-backlogs:${agencyId}:${attempt}`);
  const filesMounted = useLoad(() => files.mounted(), `home-files:${agencyId}`);
  const retry = () => setAttempt(attempt + 1);
  if (workflows.state === "loading" || held.state === "loading" || filesMounted.state === "loading") return null;
  const hasWorkflows = workflows.state === "ready" && workflows.data;
  const rows = held.state === "ready" ? held.data.filter((row) => row.id !== allIssuesId) : [];
  const options: Tab[] = [...(hasWorkflows ? [startTab, ongoingTab] : []), ...(rows.length > 0 ? [backlogsTab] : [])];
  const failedWords = [workflows.state === "error" ? "Start and Ongoing" : "", held.state === "error" ? "Backlogs" : ""].filter(Boolean).join(" and ");
  const filesRow =
    filesMounted.state === "ready" && filesMounted.data ? (
      <ListRow title="Files" start={<span className="mark" aria-hidden="true"><Icon name="folder" /></span>} end="›" onClick={() => navigate(filesHomePath())} />
    ) : null;
  const failures = failedWords ? <LoadFailed words={`${failedWords} could not be loaded.`} onRetry={retry} /> : null;
  if (options.length === 0 && !filesRow) return failures;
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
        {filesRow}
      </Rows>
      {failures}
    </>
  );
}
