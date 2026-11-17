import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { dayWords } from "../../../../shared/ui/days";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { WorkOrderAssignee } from "./WorkOrderAssignee";
import { WorkOrderStatus } from "./WorkOrderStatus";
import { aboutAndPlaceOf, placeLookupFor } from "./workOrderAsset";

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

const dueDay = (task: Item) => {
  const due = textOf(task.due_at);
  return due === "" ? "" : dayWords(due);
};

const stateAndDue = (task: Item) => {
  const day = dueDay(task);
  return day === "" ? textOf(task.state) : `${textOf(task.state)} · due ${day}`;
};

const metaWithPlace = (task: Item, place: string) => [stateAndDue(task), place].filter((part) => part !== "").join(" · ");

const loadWorkOrders = async () => {
  const open = ((await callTool("", taskList).then(itemsOf)) as Item[]).filter((task) => !isDone(task));
  const placeOf = await placeLookupFor(open);
  return open.map((task) => ({ id: textOf(task.id), title: textOf(task.title), state: textOf(task.state), due_at: textOf(task.due_at), stateAndDue: metaWithPlace(task, placeOf(task)) }));
};

const scheduleOf = (task: Item) => ({
  id: textOf(task.id),
  title: textOf(task.title),
  often: frequencyWords(textOf(task.schedule_rule)),
  rule: textOf(task.schedule_rule),
});

const loadSchedule = async () => ((await callTool("", repeatingList).then(itemsOf)) as Item[]).map(scheduleOf);

const taskRead = "taskmanager_task_read";

const repeatingRead = "taskmanager_repeating_task_read";

const workOrderEditFields = [{ label: "Title", key: "title", required: true }];

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
      listKey={version}
      detailKey={version}
      list={{ title, tool: taskList, fields: { title: "title", meta: "stateAndDue" }, empty: { words: `No ${title.toLowerCase()} yet.` }, load: loadWorkOrders }}
      detail={{
        tool: taskRead,
        fields: { Title: "title", State: "state", Due: "due", About: "about", Place: "place" },
        status: "",
        load: loadWorkOrder,
        extra: (order) => (
          <>
            <MenuEditForm item={order} id={textOf(order.id)} idArg="taskID" tool="taskmanager_task_patch" permission="task.edit" fields={workOrderEditFields} onSaved={() => setVersion((was) => was + 1)} />
            <WorkOrderAssignee order={order} onAssigned={() => setVersion((was) => was + 1)} />
            <WorkOrderStatus order={order} onMoved={() => setVersion((was) => was + 1)} />
          </>
        ),
      }}
    />
  );
}

export function MaintenancePage() {
  const word = useWord("assetmanager");
  const title = word("Maintenance Schedule");
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: repeatingList, fields: { title: "title", meta: "often" }, empty: { words: "No maintenance scheduled." }, load: loadSchedule }}
      detail={{ tool: repeatingRead, fields: { Title: "title", "How often": "often", "Schedule rule": "rule" }, status: "", load: loadScheduleItem }}
    />
  );
}
