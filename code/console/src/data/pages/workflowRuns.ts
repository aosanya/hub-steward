import { callTool } from "../../wakala/mcp";
import { roleItems, text } from "./agents";

export type OrderUnderWay = {
  id: string;
  name: string;
  workflowCode: string;
  version: number;
  startedAt: string;
  status: string;
  stepDueAt: string;
  cancelRunId: string;
};

const versionOf = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const startOf = (run: Record<string, unknown>): string => text(run.started_at) || text(run.created_at);

const readOrders = async (hubId: string, tool: string): Promise<OrderUnderWay[]> => {
  const runs = roleItems(await callTool<unknown>(hubId, tool, {}));
  return runs
    .filter((run) => text(run.id) !== "")
    .map((run) => ({
      id: text(run.id),
      name: text(run.name),
      workflowCode: text(run.workflow_code),
      version: versionOf(run.workflow_version),
      startedAt: startOf(run),
      status: text(run.status),
      stepDueAt: text(run.step_due_at),
      cancelRunId: text(run.cancel_run_id),
    }));
};

export const ordersUnderWay = (hubId: string): Promise<OrderUnderWay[]> => readOrders(hubId, "taskmanager_workflow_run_list_under_way");

export const ordersClosed = (hubId: string): Promise<OrderUnderWay[]> =>
  readOrders(hubId, "taskmanager_workflow_run_list_closed").catch(() => []);

export const ordersWithClosed = async (hubId: string): Promise<OrderUnderWay[]> => {
  const [going, closed] = await Promise.all([ordersUnderWay(hubId), ordersClosed(hubId)]);
  return [...going, ...closed];
};

export const stopOrder = async (hubId: string, runId: string, restartOnVersion = 0): Promise<void> => {
  await callTool(hubId, "taskmanager_workflow_run_stop", restartOnVersion > 0 ? { runID: runId, restart_on_version: restartOnVersion } : { runID: runId });
};
