import { itemsOf } from "../../../../features/backlogs";
import { dayWords } from "../../../../shared/ui/days";
import { callTool } from "../../../../shared/wakala/mcp";

type Item = Record<string, unknown>;

export const maintenanceKeys = ["maintenance0", "maintenance1", "maintenance2", "maintenance3", "maintenance4"];

export const finishedJobsQuery = { status: "completed", limit: 500 };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const isFinished = (task: Item) => textOf(task.state).toLowerCase() === "done" || textOf(task.status) === "completed";

const newestFinishedFirst = (one: Item, two: Item) => textOf(two.completed_at).localeCompare(textOf(one.completed_at));

const historyLine = (task: Item) => `${textOf(task.title)} · ${dayWords(textOf(task.completed_at))}`;

const finishedJobsOf = async (): Promise<Item[]> =>
  (await callTool("", "taskmanager_task_list", finishedJobsQuery).then(itemsOf).catch(() => [])) as Item[];

export const maintenanceHistoryOf = async (assetId: string) => {
  const lines = (await finishedJobsOf())
    .filter((task) => isFinished(task) && textOf(task.linked_ref) === assetId)
    .sort(newestFinishedFirst)
    .slice(0, maintenanceKeys.length)
    .map(historyLine);
  return Object.fromEntries(maintenanceKeys.map((key, at) => [key, lines[at] ?? ""]));
};
