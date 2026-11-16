import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuList } from "../../MenuList";

type Item = Record<string, unknown>;

const taskList = "taskmanager_task_list";

const repeatingList = "taskmanager_repeating_task_list";

const doneState = "done";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const isDone = (task: Item) => textOf(task.state).toLowerCase() === doneState || textOf(task.status) === "completed";

const unitWords: Record<string, string> = { DAILY: "days", WEEKLY: "weeks", MONTHLY: "months", YEARLY: "years" };

const frequencyWords = (rule: string) => {
  const frequency = /FREQ=([A-Z]+)/.exec(rule)?.[1] ?? "";
  const interval = Number(/INTERVAL=(\d+)/.exec(rule)?.[1] ?? 1);
  if (interval > 1 && unitWords[frequency]) return `Every ${interval} ${unitWords[frequency]}`;
  return frequency.charAt(0) + frequency.slice(1).toLowerCase();
};

const loadWorkOrders = async () =>
  ((await callTool("", taskList).then(itemsOf)) as Item[])
    .filter((task) => !isDone(task))
    .map((task) => ({ id: textOf(task.id), title: textOf(task.title), state: textOf(task.state) }));

const loadSchedule = async () =>
  ((await callTool("", repeatingList).then(itemsOf)) as Item[]).map((task) => ({
    id: textOf(task.id),
    title: textOf(task.title),
    often: frequencyWords(textOf(task.schedule_rule)),
  }));

export function WorkOrdersPage() {
  const word = useWord("assetmanager");
  const title = word("Work Orders");
  return <MenuList title={title} tool={taskList} fields={{ title: "title", meta: "state" }} empty={{ words: `No ${title.toLowerCase()} yet.` }} load={loadWorkOrders} />;
}

export function MaintenancePage() {
  const word = useWord("assetmanager");
  return <MenuList title={word("Maintenance Schedule")} tool={repeatingList} fields={{ title: "title", meta: "often" }} empty={{ words: "No maintenance scheduled." }} load={loadSchedule} />;
}
