import { useParams } from "react-router-dom";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { FormScreen } from "../../FormScreen";
import type { EditField } from "../../MenuEditForm";
import { personNameOf } from "../residents/personName";
import { assetPaths } from "./paths";
import { fieldShown, oftenChoices, partsOf, problemWith, ruleOf, weekdayChoices, type Often } from "./scheduleWords";

type Item = Record<string, unknown>;

const readTool = "taskmanager_repeating_task_read";

const updateTool = "taskmanager_repeating_task_update";

const createTool = "taskmanager_repeating_task_create";

const permission = "task.edit";

const zone = "UTC";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const fieldsFor = (adding: boolean, people: { value: string; label: string }[]): EditField[] => [
  { label: "Title", key: "title", required: true },
  { label: "How often", key: "often", choices: oftenChoices, ...(adding ? { required: true } : {}) },
  { label: "Weekday", key: "weekday", choices: weekdayChoices },
  { label: "Day of the month", key: "monthday", kind: "number" },
  { label: "Starting on", key: "starts", kind: "date", required: true },
  { label: "Ends on", key: "ends", kind: "date" },
  ...(adding ? [{ label: "Assigned to (you if left)", key: "assignee", choices: people }] : []),
];

const loadPeople = async () =>
  ((await callTool("", "actor_list_actors").then(itemsOf)) as Item[]).map((person) => ({ value: textOf(person.id), label: personNameOf(person) }));

const loadMyId = async () => textOf(((await callTool("", "actor_get_my_actor")) as Item | null)?.id);

const scheduleArgs = (myId: string) => (sent: Record<string, unknown>) => {
  const often = textOf(sent.often) as Often;
  const rule = ruleOf({ often, weekday: textOf(sent.weekday), monthday: String(sent.monthday ?? "") });
  const end = textOf(sent.ends);
  return {
    title: textOf(sent.title).trim(),
    schedule: { start: textOf(sent.starts), ...(end ? { end } : {}), zone, rule },
    assignee_kind: "actor",
    assignee_id: textOf(sent.assignee) || myId,
  };
};

const loadSchedule = async (scheduleId: string): Promise<Item> => {
  const reply = (await callTool("", readTool, { repeatingTaskID: scheduleId })) as Item | null;
  const task = (reply?.item as Item | undefined) ?? reply ?? {};
  const parts = partsOf(textOf(task.schedule_rule));
  return {
    ...task,
    rule: textOf(task.schedule_rule),
    often: parts?.often ?? "",
    weekday: parts?.weekday ?? "",
    monthday: parts?.monthday ?? "",
    starts: textOf(task.schedule_start),
    ends: textOf(task.schedule_end),
  };
};

const instantOf = (value: unknown) => {
  const text = textOf(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : text;
};

const dayOf = (value: unknown) => textOf(value).slice(0, 10);

const timeOf = (value: unknown) => /T(\d{2}:\d{2}:\d{2}Z)$/.exec(textOf(value))?.[1] ?? "00:00:00Z";

const startOf = (task: Item, chosen: unknown) => (dayOf(chosen) === dayOf(task.starts) ? textOf(task.starts) : `${dayOf(chosen)}T${timeOf(task.starts)}`);

const changedScheduleFrom = (scheduleId: string, task: Item, sent: Record<string, unknown>) => {
  const merged = { ...task, ...sent };
  const often = textOf(merged.often) as Often | "";
  const rule = often ? ruleOf({ often, weekday: textOf(merged.weekday), monthday: String(merged.monthday ?? "") }) : textOf(task.rule);
  const end = instantOf(merged.ends);
  return {
    repeatingTaskID: scheduleId,
    title: textOf(merged.title),
    ...(textOf(task.description) ? { description: textOf(task.description) } : {}),
    ...(textOf(task.assignee_kind) ? { assignee_kind: textOf(task.assignee_kind), assignee_id: textOf(task.assignee_id) } : {}),
    schedule: { start: startOf(task, merged.starts), ...(end ? { end } : {}), zone: textOf(task.schedule_zone), rule },
  };
};

export function ScheduleEditScreen() {
  const { scheduleId = "" } = useParams();
  const adding = scheduleId === "";
  const people = useLoad(adding ? loadPeople : async () => [], `schedule-people:${openAgencyId()}:${adding}`);
  const mine = useLoad(adding ? loadMyId : async () => "", `schedule-me:${openAgencyId()}:${adding}`);
  return (
    <FormScreen
      id={scheduleId}
      word="schedule"
      listLabel="Maintenance Schedule"
      addedTo={assetPaths.maintenance.path()}
      editedTo={assetPaths.maintenance.path({ item: scheduleId })}
      permission={permission}
      load={loadSchedule}
      nameOf={(task) => textOf(task.title)}
      addTool={createTool}
      addBuild={scheduleArgs(mine.state === "ready" ? mine.data : "")}
      editTool={updateTool}
      idArg="repeatingTaskID"
      editBuild={(task) => (sent) => changedScheduleFrom(scheduleId, task, sent)}
      fields={fieldsFor(adding, people.state === "ready" ? people.data : [])}
      visible={(key, values) => fieldShown(key, values.often ?? "")}
      check={(values) => problemWith({ often: values.often ?? "", weekday: values.weekday ?? "", monthday: values.monthday ?? "" })}
    />
  );
}
