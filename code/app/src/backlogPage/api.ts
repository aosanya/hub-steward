import { defaultBacklogId, defaultBacklogName, issueOf, taskTools } from "../backlogs/api";
import { callTool } from "../wakala/mcp";

export type PageStep = { name: string; issues: number };

export type AccessLevel = "Can move" | "Can see";

export type PageGroup = { name: string; level: AccessLevel };

export type BacklogPageData = { name: string; steps: PageStep[]; groups: PageGroup[] };

export type BacklogPageClient = {
  page: (backlogId: string) => Promise<BacklogPageData | undefined>;
};

type StateRow = { name: string; statuses: string[] };

export const productOwnerGroup: PageGroup = { name: "Product owner", level: "Can move" };

const listCap = 500;

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : []);

export const stateRowOf = (raw: any): StateRow => ({
  name: text(raw?.name),
  statuses: Array.isArray(raw?.statuses) ? raw.statuses.filter((status: unknown) => typeof status === "string") : [],
});

export const stepOfIssue = (states: StateRow[], issue: { step: string; status: string }) =>
  states.find((state) => state.name !== "" && state.name === issue.step) ?? states.find((state) => state.statuses.includes(issue.status));

export const stepsWithCounts = (states: StateRow[], issues: { step: string; status: string }[]): PageStep[] =>
  states.map((state) => ({ name: state.name, issues: issues.filter((issue) => stepOfIssue(states, issue) === state).length }));

export const mcpBacklogPageClient: BacklogPageClient = {
  async page(backlogId) {
    if (backlogId !== defaultBacklogId) return undefined;
    const [stateReply, taskReply] = await Promise.all([callTool("", taskTools.states, {}), callTool("", taskTools.list, { limit: listCap })]);
    const states = itemsOf(stateReply).map(stateRowOf).filter((state) => state.name !== "");
    const issues = itemsOf(taskReply).map(issueOf);
    return { name: defaultBacklogName, steps: stepsWithCounts(states, issues), groups: [productOwnerGroup] };
  },
};
