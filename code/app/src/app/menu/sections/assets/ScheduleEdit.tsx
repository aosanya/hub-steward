import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool, McpError } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuEditForm, refusalWords } from "../../MenuEditForm";
import type { EditField } from "../../MenuEditForm";
import { assetPaths } from "./paths";
import { fieldShown, oftenChoices, partsOf, problemWith, ruleOf, weekdayChoices, type Often } from "./scheduleWords";

type Item = Record<string, unknown>;

const readTool = "taskmanager_repeating_task_read";

const createTool = "taskmanager_repeating_task_create";

const stopTool = "taskmanager_repeating_task_stop";

const permission = "task.edit";

const stillRunning = "The new schedule was saved but the old one is still running";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const fields: EditField[] = [
  { label: "Title", key: "title", required: true },
  { label: "How often", key: "often", choices: oftenChoices },
  { label: "Weekday", key: "weekday", choices: weekdayChoices },
  { label: "Day of the month", key: "monthday", kind: "number" },
  { label: "Starting on", key: "starts", kind: "date", required: true },
  { label: "Ends on", key: "ends", kind: "date" },
];

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

const dayAfter = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

const startOf = (task: Item, chosen: unknown) => {
  if (dayOf(chosen) !== dayOf(task.starts)) return `${dayOf(chosen)}T${timeOf(task.starts)}`;
  const lastJob = textOf(task.last_due_at);
  return lastJob ? `${dayAfter(dayOf(lastJob))}T${timeOf(task.starts)}` : textOf(task.starts);
};

const newScheduleFrom = (task: Item, sent: Record<string, unknown>) => {
  const merged = { ...task, ...sent };
  const often = textOf(merged.often) as Often | "";
  const rule = often ? ruleOf({ often, weekday: textOf(merged.weekday), monthday: String(merged.monthday ?? "") }) : textOf(task.rule);
  const end = instantOf(merged.ends);
  return {
    title: textOf(merged.title),
    ...(textOf(task.description) ? { description: textOf(task.description) } : {}),
    ...(textOf(task.assignee_kind) ? { assignee_kind: textOf(task.assignee_kind), assignee_id: textOf(task.assignee_id) } : {}),
    schedule: { start: startOf(task, merged.starts), ...(end ? { end } : {}), zone: textOf(task.schedule_zone), rule },
  };
};

const stopOld = (scheduleId: string) => async () => {
  try {
    await callTool("", stopTool, { repeatingTaskID: scheduleId });
  } catch (error) {
    const reason = error instanceof McpError ? refusalWords(error) : "";
    throw new McpError(`${stopTool}: ${stillRunning}${reason ? `: ${reason}` : ""}`);
  }
};

export function ScheduleEditScreen() {
  const { scheduleId = "" } = useParams();
  const navigate = useNavigate();
  const view = useLoad(() => loadSchedule(scheduleId), `schedule-edit:${openAgencyId()}:${scheduleId}`);
  const back = () => navigate(assetPaths.maintenance.path({ item: scheduleId }));
  const title = view.state === "ready" ? textOf(view.data.title) : "";
  return (
    <Shell title="Edit schedule" titleUnder onBack={back} backLabel={title || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" ? (
        <div className="person-page">
          <MenuEditForm
            item={view.data}
            id={scheduleId}
            idArg="repeatingTaskID"
            tool={createTool}
            permission={permission}
            bare
            openCount={1}
            fields={fields}
            build={(sent) => newScheduleFrom(view.data, sent)}
            alsoSave={stopOld(scheduleId)}
            retryLabel="Stop the old schedule"
            visible={(key, values) => fieldShown(key, values.often ?? "")}
            check={(values) => problemWith({ often: values.often ?? "", weekday: values.weekday ?? "", monthday: values.monthday ?? "" })}
            onSaved={() => navigate(assetPaths.maintenance.path())}
            onCancel={back}
          />
        </div>
      ) : null}
    </Shell>
  );
}
