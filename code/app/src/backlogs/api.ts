import { callTool } from "../wakala/mcp";
import { noteOf, type IssueNote } from "./issueNotes";
import { markPrecedence, type Mark } from "./marks";
import { pendingCountsOf, type StepCount } from "./stepCounts";

export const taskTools = {
  list: "taskmanager_task_list",
  get: "taskmanager_task_read",
  edges: "taskmanager_relationship_traverse",
  backlogs: "taskmanager_backlog_list",
  pending: "taskmanager_task_pending",
  notes: "taskmanager_task_note_list",
  addNote: "taskmanager_task_note_add",
  patch: "taskmanager_task_patch",
};

export const listCap = 500;

export const allIssuesId = "all";

export const defaultBacklogId = "backlog";

export type Issue = {
  id: string;
  key?: string;
  code?: string;
  title: string;
  description: string;
  status: string;
  step: string;
  repo: string;
  topics: string[];
  backlog: string;
  backlogId?: string;
  mark: Mark;
  rank: number;
  priority?: string;
  createdAt?: string;
  completedAt?: string;
};

export type IssueDetail = Issue & { waitsOn: Issue[]; waitedOnBy: Issue[] };

export type Backlog = { id: string; name: string; steps: string[]; issues: number; kind?: "smart"; counts?: StepCount[] };

export type BacklogsClient = {
  backlogs: () => Promise<Backlog[]>;
  issues: (backlogId?: string) => Promise<Issue[]>;
  issue: (id: string) => Promise<IssueDetail>;
  smartCounts?: (smarts: Backlog[]) => Promise<Record<string, StepCount[]>>;
  setPriority?: (id: string, priority: string) => Promise<void>;
};

export type NotesClient = {
  notes: (id: string) => Promise<IssueNote[]>;
  addNote: (id: string, text: string) => Promise<IssueNote>;
};

export const issuesHeld = (backlogs: { issues: number; kind?: "smart" }[]) =>
  backlogs.reduce((sum, one) => (one.kind === "smart" ? sum : sum + one.issues), 0);

export type HubStep = { id: string; name: string; issues: number };

export type HubBacklog = { id: string; name: string; steps: HubStep[]; issues: number; kind?: "smart" };

const text = (value: unknown) => (typeof value === "string" ? value : "");

const count = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0);

export const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : Array.isArray(reply?.tasks) ? reply.tasks : []);

export const settled = new Set(["completed", "cancelled"]);

const markOf = (raw: any, status: string): Mark =>
  settled.has(status) ? "" : raw?.blocked === true ? "Blocked" : raw?.sinbin === true ? "Sinbin" : raw?.waiting === true ? "Waiting" : "";

const rankOf = (raw: any) => (typeof raw?.rank === "number" && raw.rank > 0 ? raw.rank : Number.MAX_SAFE_INTEGER);

export const hubBacklogOf = (raw: any): HubBacklog => ({
  id: text(raw?.id),
  name: text(raw?.name),
  issues: count(raw?.issues),
  steps: itemsOfSteps(raw?.steps),
  ...(raw?.kind === "smart" ? { kind: "smart" as const } : {}),
});

function itemsOfSteps(raw: unknown): HubStep[] {
  return (Array.isArray(raw) ? raw : [])
    .map((step: any) => ({ id: text(step?.id), name: text(step?.name), issues: count(step?.issues) }))
    .filter((step) => step.name !== "");
}

export const hubBacklogsOf = (reply: any): HubBacklog[] => itemsOf(reply).map(hubBacklogOf).filter((one) => one.id !== "");

export const backlogOf = (one: HubBacklog): Backlog => ({
  id: one.id,
  name: one.name,
  steps: one.steps.map((step) => step.name),
  issues: one.issues,
  counts: one.steps.map((step) => ({ name: step.name, issues: step.issues })),
  ...(one.kind ? { kind: one.kind } : {}),
});

export const issueOf = (raw: any, hub: HubBacklog[] = []): Issue => {
  const status = text(raw?.status);
  const tags: string[] = Array.isArray(raw?.tags) ? raw.tags.filter((tag: unknown) => typeof tag === "string" && tag !== "") : [];
  const own = settled.has(status) ? undefined : markPrecedence.find((mark) => tags.includes(mark));
  const backlog = hub.find((one) => one.id === text(raw?.backlog)) ?? hub[0];
  const step = backlog?.steps.find((one) => one.id === text(raw?.step) || one.name === text(raw?.step));
  const placed = text(raw?.backlog) !== "";
  return {
    id: text(raw?.id),
    ...(text(raw?.task_name) !== "" ? { key: text(raw?.task_name) } : {}),
    ...(text(raw?.code) !== "" ? { code: text(raw?.code) } : {}),
    title: text(raw?.title) || text(raw?.task_name),
    description: text(raw?.description),
    status,
    step: step?.name ?? (placed ? "" : text(raw?.state)),
    repo: text(raw?.project_name),
    topics: tags.filter((tag) => !markPrecedence.includes(tag as Mark)),
    backlog: backlog?.name ?? "",
    backlogId: text(raw?.backlog),
    mark: own ?? markOf(raw, status),
    rank: rankOf(raw),
    priority: text(raw?.priority),
    ...(text(raw?.created_at) !== "" ? { createdAt: text(raw?.created_at) } : {}),
    ...(text(raw?.completed_at) !== "" ? { completedAt: text(raw?.completed_at) } : {}),
  };
};

export const stepsOf = (reply: any): string[] => itemsOf(reply).map((raw) => text(raw?.name)).filter((name) => name !== "");

const hubBacklogs = async () => hubBacklogsOf(await callTool("", taskTools.backlogs, {}));

type Query = Record<string, string>;

const pageOf = async (query: Query, offset: number) =>
  itemsOf(await callTool("", taskTools.list, offset === 0 ? { ...query, limit: listCap } : { ...query, limit: listCap, offset }));

const fetchAll = async (query: Query): Promise<any[]> => {
  const rows: any[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += listCap) {
    const page = await pageOf(query, offset);
    const fresh = page.filter((raw) => !seen.has(text(raw?.id)));
    fresh.forEach((raw) => seen.add(text(raw?.id)));
    rows.push(...fresh);
    if (page.length < listCap || fresh.length === 0) return rows;
  }
};

const issueList = async (backlogId: string, hub: HubBacklog[]) => {
  const rows = await fetchAll(backlogId === allIssuesId ? {} : { backlog: backlogId });
  return rows.map((raw) => issueOf(raw, hub)).filter((issue) => issue.id !== "");
};

export const mcpBacklogsClient: BacklogsClient = {
  async backlogs() {
    return (await hubBacklogs()).map(backlogOf);
  },
  async smartCounts(smarts) {
    const read = async (one: Backlog) => {
      try {
        return pendingCountsOf(await callTool("", taskTools.pending, { backlog: one.id, limit: 1, include_closed: true }));
      } catch {
        return [];
      }
    };
    return Object.fromEntries(await Promise.all(smarts.map(async (one) => [one.id, await read(one)] as const)));
  },
  async issues(backlogId = allIssuesId) {
    return issueList(backlogId, await hubBacklogs());
  },
  async setPriority(id, priority) {
    await callTool("", taskTools.patch, { taskID: id, priority });
  },
  async issue(id) {
    const [raw, outbound, inbound, hub] = await Promise.all([
      callTool("", taskTools.get, { taskID: id }),
      callTool("", taskTools.edges, { vertex_id: id, label: "depends_on", direction: "outbound" }),
      callTool("", taskTools.edges, { vertex_id: id, label: "depends_on", direction: "inbound" }).catch(() => []),
      hubBacklogs(),
    ]);
    const read = (edges: unknown, end: string) =>
      Promise.all(
        itemsOf(edges)
          .map((edge) => text(edge?.[end]))
          .filter((target) => target !== "")
          .map(async (target) => issueOf(await callTool("", taskTools.get, { taskID: target }), hub)),
      );
    const [waitsOn, waitedOnBy] = await Promise.all([read(outbound, "to_id"), read(inbound, "from_id")]);
    return { ...issueOf(raw, hub), waitsOn, waitedOnBy };
  },
};

export const mcpNotesClient: NotesClient = {
  async notes(id) {
    return itemsOf(await callTool("", taskTools.notes, { taskID: id })).map(noteOf);
  },
  async addNote(id, text) {
    return noteOf(await callTool("", taskTools.addNote, { taskID: id, text, kind: "person" }));
  },
};
