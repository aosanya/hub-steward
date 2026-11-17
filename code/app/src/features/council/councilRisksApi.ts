import { actionOf, riskOf, riskTools, type Risk, type RiskAction } from "../../features/risks/api";
import { listPeople, namesOf, type Names } from "../../features/people/api";
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

const actorId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ownerName = (owner: string, names: Names): string =>
  names.get(owner) ?? (actorId.test(owner) ? "" : owner);

const knownNames = async (): Promise<Names> => namesOf(await listPeople().catch(() => []));

export const mcpCouncilRisksClient: CouncilRisksClient = {
  async load() {
    const [risks, actions, names] = await Promise.all([
      callTool("", riskTools.risks, {}),
      callTool("", riskTools.actions, {}),
      knownNames(),
    ]);
    return {
      risks: rowsOf(risks).map(riskOf).map((risk) => ({ ...risk, owner: ownerName(risk.owner, names) })),
      overdueActions: overdueOf(rowsOf(actions).map(actionOf)).map((action) => ({ ...action, owner: ownerName(action.owner, names) })),
    };
  },
};
