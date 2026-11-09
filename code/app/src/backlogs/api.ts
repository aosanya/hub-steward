import { callTool } from "../wakala/mcp";

export const taskTools = {
  list: "taskmanager_list_tasks",
  states: "taskmanager_list_task_states",
  get: "taskmanager_get_task",
  edges: "taskmanager_traverse_relationships",
};

export const allIssuesId = "all";

export const defaultBacklogId = "default";

export const defaultBacklogName = "Backlog";

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

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : Array.isArray(reply?.tasks) ? reply.tasks : []);

const settled = new Set(["completed", "cancelled"]);

const markOf = (status: string): Mark => (settled.has(status) ? "" : status === "blocked" ? "Blocked" : "Ready");

const rankOf = (raw: any) => (typeof raw?.rank === "number" && raw.rank > 0 ? raw.rank : Number.MAX_SAFE_INTEGER);

export const issueOf = (raw: any): Issue => {
  const status = text(raw?.status);
  return {
    id: text(raw?.id),
    title: text(raw?.title) || text(raw?.task_name),
    description: text(raw?.description),
    status,
    step: text(raw?.state),
    repo: text(raw?.project_name),
    topics: Array.isArray(raw?.tags) ? raw.tags.filter((tag: unknown) => typeof tag === "string" && tag !== "") : [],
    backlog: defaultBacklogName,
    mark: markOf(status),
    rank: rankOf(raw),
  };
};

export const inRankOrder = (issues: Issue[]) => [...issues].sort((a, b) => a.rank - b.rank);

export const stepsOf = (reply: any): string[] => itemsOf(reply).map((raw) => text(raw?.name)).filter((name) => name !== "");

const issueList = async () => inRankOrder(itemsOf(await callTool("", taskTools.list, {})).map(issueOf).filter((issue) => issue.id !== ""));

export const mcpBacklogsClient: BacklogsClient = {
  async backlogs() {
    const [states, issues] = await Promise.all([callTool("", taskTools.states, {}), issueList()]);
    return [{ id: defaultBacklogId, name: defaultBacklogName, steps: stepsOf(states), issues: issues.length }];
  },
  async issues() {
    return issueList();
  },
  async issue(id) {
    const [raw, edges] = await Promise.all([
      callTool("", taskTools.get, { taskID: id }),
      callTool("", taskTools.edges, { vertex_id: id, label: "depends_on", direction: "outbound" }),
    ]);
    const targets: string[] = itemsOf(edges).map((edge) => text(edge?.to_id)).filter((target) => target !== "");
    const waitsOn = await Promise.all(
      targets.map(async (target) => ({ id: target, title: issueOf(await callTool("", taskTools.get, { taskID: target })).title })),
    );
    return { ...issueOf(raw), waitsOn };
  },
};
