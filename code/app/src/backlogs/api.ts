import { callTool } from "../wakala/mcp";

export const taskTools = {
  list: "taskmanager_task_list",
  get: "taskmanager_task_read",
  edges: "taskmanager_relationship_traverse",
  backlogs: "taskmanager_backlog_list",
};

export const listCap = 500;

export const allIssuesId = "all";

export const defaultBacklogId = "backlog";

export type Mark = "Ready" | "Blocked" | "";

export type Issue = {
  id: string;
  title: string;
  description: string;
  status: string;
  step: string;
  repo: string;
  topics: string[];
  backlog: string;
  mark: Mark;
  rank: number;
};

export type IssueDetail = Issue & { waitsOn: { id: string; title: string }[] };

export type Backlog = { id: string; name: string; steps: string[]; issues: number };

export type BacklogsClient = {
  backlogs: () => Promise<Backlog[]>;
  issues: (backlogId?: string) => Promise<Issue[]>;
  issue: (id: string) => Promise<IssueDetail>;
};

export type HubStep = { id: string; name: string; issues: number };

export type HubBacklog = { id: string; name: string; steps: HubStep[]; issues: number };

const text = (value: unknown) => (typeof value === "string" ? value : "");

const count = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0);

export const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : Array.isArray(reply?.tasks) ? reply.tasks : []);

const settled = new Set(["completed", "cancelled"]);

const marks: Mark[] = ["Blocked", "Ready"];

const derivedMark = (status: string): Mark => (settled.has(status) ? "" : status === "blocked" ? "Blocked" : "Ready");

const rankOf = (raw: any) => (typeof raw?.rank === "number" && raw.rank > 0 ? raw.rank : Number.MAX_SAFE_INTEGER);

export const hubBacklogOf = (raw: any): HubBacklog => ({
  id: text(raw?.id),
  name: text(raw?.name),
  issues: count(raw?.issues),
  steps: itemsOfSteps(raw?.steps),
});

function itemsOfSteps(raw: unknown): HubStep[] {
  return (Array.isArray(raw) ? raw : [])
    .map((step: any) => ({ id: text(step?.id), name: text(step?.name), issues: count(step?.issues) }))
    .filter((step) => step.name !== "");
}

export const hubBacklogsOf = (reply: any): HubBacklog[] => itemsOf(reply).map(hubBacklogOf).filter((one) => one.id !== "");

export const backlogOf = (one: HubBacklog): Backlog => ({ id: one.id, name: one.name, steps: one.steps.map((step) => step.name), issues: one.issues });

export const issueOf = (raw: any, hub: HubBacklog[] = []): Issue => {
  const status = text(raw?.status);
  const tags: string[] = Array.isArray(raw?.tags) ? raw.tags.filter((tag: unknown) => typeof tag === "string" && tag !== "") : [];
  const own = settled.has(status) ? undefined : marks.find((mark) => tags.includes(mark));
  const backlog = hub.find((one) => one.id === text(raw?.backlog)) ?? hub[0];
  const step = backlog?.steps.find((one) => one.id === text(raw?.step) || one.name === text(raw?.step));
  return {
    id: text(raw?.id),
    title: text(raw?.title) || text(raw?.task_name),
    description: text(raw?.description),
    status,
    step: step?.name ?? text(raw?.state),
    repo: text(raw?.project_name),
    topics: tags.filter((tag) => !marks.includes(tag as Mark)),
    backlog: backlog?.name ?? "",
    mark: own ?? derivedMark(status),
    rank: rankOf(raw),
  };
};

export const inRankOrder = (issues: Issue[]) => [...issues].sort((a, b) => a.rank - b.rank);

export const stepsOf = (reply: any): string[] => itemsOf(reply).map((raw) => text(raw?.name)).filter((name) => name !== "");

const hubBacklogs = async () => hubBacklogsOf(await callTool("", taskTools.backlogs, {}));

const priorities = ["critical", "high", "medium", "low"];

type Query = Record<string, string>;

const fetchPage = async (query: Query) => itemsOf(await callTool("", taskTools.list, { ...query, limit: listCap }));

const worth = (steps: HubStep[]) => (steps.some((step) => step.issues > 0) ? steps.filter((step) => step.issues > 0) : steps);

const splits = (query: Query, hub: HubBacklog[]): Query[] => {
  if (!query.backlog && hub.length > 1) return hub.map((one) => ({ ...query, backlog: one.id }));
  if (!query.backlog) return splits({ ...query, backlog: hub[0]?.id ?? defaultBacklogId }, hub);
  if (!query.step) return worth(hub.find((one) => one.id === query.backlog)?.steps ?? []).map((step) => ({ ...query, step: step.id || step.name }));
  if (!query.priority) return priorities.map((priority) => ({ ...query, priority }));
  return [];
};

const fetchAll = async (query: Query, hub: HubBacklog[]): Promise<any[]> => {
  const page = await fetchPage(query);
  if (page.length < listCap) return page;
  const parts = splits(query, hub);
  if (parts.length === 0) return page;
  const rest = await Promise.all(parts.map((part) => fetchAll(part, hub)));
  return rest.flat();
};

const issueList = async (backlogId: string, hub: HubBacklog[]) => {
  const rows = await fetchAll(backlogId === allIssuesId ? {} : { backlog: backlogId }, hub);
  const seen = new Set<string>();
  const issues = rows.map((raw) => issueOf(raw, hub)).filter((issue) => issue.id !== "" && !seen.has(issue.id) && seen.add(issue.id));
  return inRankOrder(issues);
};

export const mcpBacklogsClient: BacklogsClient = {
  async backlogs() {
    return (await hubBacklogs()).map(backlogOf);
  },
  async issues(backlogId = allIssuesId) {
    return issueList(backlogId, await hubBacklogs());
  },
  async issue(id) {
    const [raw, edges, hub] = await Promise.all([
      callTool("", taskTools.get, { taskID: id }),
      callTool("", taskTools.edges, { vertex_id: id, label: "depends_on", direction: "outbound" }),
      hubBacklogs(),
    ]);
    const targets: string[] = itemsOf(edges).map((edge) => text(edge?.to_id)).filter((target) => target !== "");
    const waitsOn = await Promise.all(
      targets.map(async (target) => ({ id: target, title: issueOf(await callTool("", taskTools.get, { taskID: target })).title })),
    );
    return { ...issueOf(raw, hub), waitsOn };
  },
};
