import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { dayWords } from "../../../../shared/ui/days";
import { callTool } from "../../../../shared/wakala/mcp";
import { AddButton } from "../../AddButton";
import { MenuWindow } from "../../MenuWindow";
import { SchedulePanel, WorkOrderPanel } from "./AssetPanels";
import { assetPaths } from "./paths";
import { aboutAndPlaceOf, placeLookupFor } from "./workOrderAsset";

type Item = Record<string, unknown>;

export const taskList = "taskmanager_task_list";

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

const dayOf = (value: unknown) => {
  const text = textOf(value);
  return text === "" ? "" : dayWords(text);
};

const dueDay = (task: Item) => dayOf(task.due_at);

export const stateAndDue = (task: Item) => {
  const day = dueDay(task);
  return day === "" ? textOf(task.state) : `${textOf(task.state)} · due ${day}`;
};

const metaWithPlace = (task: Item, place: string) => [stateAndDue(task), place].filter((part) => part !== "").join(" · ");

const loadWorkOrders = async () => {
  const open = ((await callTool("", taskList).then(itemsOf)) as Item[]).filter((task) => !isDone(task));
  const placeOf = await placeLookupFor(open);
  return open.map((task) => ({ id: textOf(task.id), title: textOf(task.title), state: textOf(task.state), due_at: textOf(task.due_at), stateAndDue: metaWithPlace(task, placeOf(task)) }));
};

const withPrefix = (prefix: string, day: string) => (day === "" ? "" : `${prefix} ${day}`);

const upkeepParts = (schedule: { often: string; next: string }) => [schedule.often, withPrefix("next", schedule.next)];

const scheduleOf = (task: Item) => {
  const schedule = {
    id: textOf(task.id),
    title: textOf(task.title),
    often: frequencyWords(textOf(task.schedule_rule)),
    next: dayOf(task.next_due_at),
    rule: textOf(task.schedule_rule),
    lastUpkeep: dayOf(task.last_done_at),
    lastJobDue: textOf(task.last_done_at) === "" ? dayOf(task.last_due_at) : "",
  };
  return { ...schedule, oftenAndNext: upkeepParts(schedule).filter((part) => part !== "").join(" · ") };
};

const isRunning = (task: Item) => textOf(task.stopped_at) === "";

const loadSchedule = async () => ((await callTool("", repeatingList).then(itemsOf)) as Item[]).filter(isRunning).map(scheduleOf);

const taskRead = "taskmanager_task_read";

const repeatingRead = "taskmanager_repeating_task_read";

const readOne = async (tool: string, args: Record<string, string>) => {
  const reply = (await callTool("", tool, args)) as { item?: unknown } | null;
  const inner = reply?.item ?? reply;
  return inner && typeof inner === "object" ? (inner as Item) : {};
};

const loadWorkOrder = async (taskId: string) => {
  const task = await readOne(taskRead, { taskID: taskId });
  return { ...task, due: dueDay(task), ...(await aboutAndPlaceOf(task)) };
};

const loadScheduleItem = async (repeatingTaskId: string) => scheduleOf(await readOne(repeatingRead, { repeatingTaskID: repeatingTaskId }));

export function WorkOrdersPage() {
  const word = useWord("assetmanager");
  const title = word("Work Orders");
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      above={<AddButton permission="task.edit" label={`Add ${word("Work Order").toLowerCase()}`} to={assetPaths.workOrderNew.path()} />}
      listKey={version}
      detailKey={version}
      list={{ title, tool: taskList, fields: { title: "title", meta: "stateAndDue" }, empty: { words: `No ${title.toLowerCase()} yet.` }, load: loadWorkOrders }}
      detail={{ tool: taskRead, fields: {}, status: "", load: loadWorkOrder, extra: (order) => <WorkOrderPanel order={order} onChanged={() => setVersion((was) => was + 1)} /> }}
    />
  );
}

export function MaintenancePage() {
  const word = useWord("assetmanager");
  const title = word("Maintenance Schedule");
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      above={<AddButton permission="task.edit" label="Add schedule" to={assetPaths.maintenanceNew.path()} />}
      list={{ title, tool: repeatingList, fields: { title: "title", meta: "oftenAndNext" }, empty: { words: "No maintenance scheduled." }, load: loadSchedule }}
      detail={{ tool: repeatingRead, fields: {}, status: "", load: loadScheduleItem, extra: (item) => <SchedulePanel item={item} /> }}
    />
  );
}
