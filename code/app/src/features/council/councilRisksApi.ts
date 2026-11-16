import { actionOf, riskOf, riskTools, type Risk, type RiskAction } from "../../features/risks/api";
import { isoDay } from "../../shared/ui/days";
import { callTool } from "../../shared/wakala/mcp";

export type CouncilRisks = { risks: Risk[]; overdueActions: RiskAction[] };

export type CouncilRisksClient = { load(): Promise<CouncilRisks> };

const finished = new Set(["done", "completed", "closed", "dropped"]);

const rowsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : []);

export const overdueOf = (actions: RiskAction[], today: Date = new Date()): RiskAction[] => {
  const cutoff = isoDay(today.toISOString());
  return actions
    .filter((action) => action.dueAt !== "" && !finished.has(action.status) && isoDay(action.dueAt) < cutoff)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
};

export const mcpCouncilRisksClient: CouncilRisksClient = {
  async load() {
    const [risks, actions] = await Promise.all([callTool("", riskTools.risks, {}), callTool("", riskTools.actions, {})]);
    return { risks: rowsOf(risks).map(riskOf), overdueActions: overdueOf(rowsOf(actions).map(actionOf)) };
  },
};
