import { hubBacklogsOf, taskTools } from "../backlogs/api";
import { mcpBacklogAccessClient } from "../backlogAccess/api";
import { levelWords, rowsOf } from "../backlogAccess/levels";
import { callTool } from "../wakala/mcp";

export type PageStep = { name: string; issues: number };

export type AccessLevel = "Can move" | "Can see";

export type PageGroup = { name: string; level: AccessLevel };

export type PageAccess = { restricted: boolean; groups: PageGroup[] };

export type BacklogPageData = { name: string; steps: PageStep[]; noStep: number; access?: PageAccess };

export type BacklogPageClient = {
  page: (backlogId: string) => Promise<BacklogPageData | undefined>;
};

const accessOf = async (backlogId: string): Promise<PageAccess | undefined> => {
  try {
    const [reading, groups] = await Promise.all([mcpBacklogAccessClient.read(backlogId), mcpBacklogAccessClient.groups()]);
    const rows = rowsOf(reading, groups);
    return { restricted: reading.ownerGroup !== "", groups: rows.map((row) => ({ name: row.name, level: levelWords(row.level) as AccessLevel })) };
  } catch {
    return undefined;
  }
};

export const mcpBacklogPageClient: BacklogPageClient = {
  async page(backlogId) {
    const found = hubBacklogsOf(await callTool("", taskTools.backlogs, {})).find((one) => one.id === backlogId);
    if (!found) return undefined;
    const atSteps = found.steps.reduce((sum, step) => sum + step.issues, 0);
    return {
      name: found.name,
      steps: found.steps.map((step) => ({ name: step.name, issues: step.issues })),
      noStep: Math.max(found.issues - atSteps, 0),
      access: await accessOf(backlogId),
    };
  },
};
