import { hubBacklogsOf, taskTools } from "../backlogs/api";
import { callTool } from "../wakala/mcp";

export type PageStep = { name: string; issues: number };

export type AccessLevel = "Can move" | "Can see";

export type PageGroup = { name: string; level: AccessLevel };

export type BacklogPageData = { name: string; steps: PageStep[]; groups: PageGroup[] };

export type BacklogPageClient = {
  page: (backlogId: string) => Promise<BacklogPageData | undefined>;
};

export const productOwnerGroup: PageGroup = { name: "Product owner", level: "Can move" };

export const mcpBacklogPageClient: BacklogPageClient = {
  async page(backlogId) {
    const found = hubBacklogsOf(await callTool("", taskTools.backlogs, {})).find((one) => one.id === backlogId);
    if (!found) return undefined;
    return { name: found.name, steps: found.steps.map((step) => ({ name: step.name, issues: step.issues })), groups: [productOwnerGroup] };
  },
};
