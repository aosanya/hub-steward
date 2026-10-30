import { McpError, callTool } from "../wakala/mcp";
import { loadScenarios, type Scenario } from "./scenario";

export type WorkflowRemoval = { kind: "removed" } | { kind: "refused"; scenarios: Scenario[] };

export const removeWorkflow = async (hubId: string, workflowId: string): Promise<WorkflowRemoval> => {
  try {
    await callTool(hubId, "agency_delete_workflow", { workflow_id: workflowId });
    return { kind: "removed" };
  } catch (error) {
    if (!(error instanceof McpError)) throw error;
    const scenarios = await loadScenarios(hubId).catch(() => []);
    const mirroring = scenarios.filter((scenario) => scenario.workflowId === workflowId);
    if (mirroring.length === 0) throw error;
    return { kind: "refused", scenarios: mirroring };
  }
};

export const removeScenario = async (hubId: string, scenarioId: string): Promise<void> => {
  await callTool(hubId, "agency_delete_scenario", { scenario_id: scenarioId });
};
