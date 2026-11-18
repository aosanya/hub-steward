import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { AddScreen } from "../../AddScreen";
import type { EditField } from "../../MenuEditForm";
import { personNameOf } from "../residents/personName";
import { assetPaths } from "./paths";
import { fieldShown, oftenChoices, problemWith, ruleOf, weekdayChoices, type Often } from "./scheduleWords";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const loadPeople = async () =>
  ((await callTool("", "actor_list_actors").then(itemsOf)) as Item[]).map((person) => ({ value: textOf(person.id), label: personNameOf(person) }));

const loadMyId = async () => textOf(((await callTool("", "actor_get_my_actor")) as Item | null)?.id);

const zone = "UTC";

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

export function ScheduleNewScreen() {
  const people = useLoad(loadPeople, `schedule-new-people:${openAgencyId()}`);
  const mine = useLoad(loadMyId, `schedule-new-me:${openAgencyId()}`);
  const fields: EditField[] = [
    { label: "Title", key: "title", required: true },
    { label: "How often", key: "often", required: true, choices: oftenChoices },
    { label: "Weekday", key: "weekday", choices: weekdayChoices },
    { label: "Day of the month", key: "monthday", kind: "number" },
    { label: "Starting on", key: "starts", kind: "date", required: true },
    { label: "Ends on", key: "ends", kind: "date" },
    { label: "Assigned to (you if left)", key: "assignee", choices: people.state === "ready" ? people.data : [] },
  ];
  return (
    <AddScreen
      title="Add schedule"
      backLabel="Maintenance Schedule"
      backTo={assetPaths.maintenance.path()}
      permission="task.edit"
      tool="taskmanager_repeating_task_create"
      fields={fields}
      build={scheduleArgs(mine.state === "ready" ? mine.data : "")}
      visible={(key, values) => fieldShown(key, values.often ?? "")}
      check={(values) => problemWith({ often: values.often ?? "", weekday: values.weekday ?? "", monthday: values.monthday ?? "" })}
    />
  );
}
