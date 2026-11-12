import { settled } from "../backlogs/api";
import { callTool, McpError } from "../wakala/mcp";
import type { NotificationItem } from "./api";

export type Reader = (tool: string, args: Record<string, unknown>) => Promise<any>;

export type SubjectState = "there" | "done" | "gone" | "unknown";

type Reading = { tool: string; arg: string; noun: string; finishes: boolean };

const taskReading: Reading = { tool: "taskmanager_task_read", arg: "taskID", noun: "task", finishes: true };
const formReading: Reading = { tool: "forms_form_read", arg: "form_id", noun: "form", finishes: false };

const readings = new Map<string, Reading>([
  ["task", taskReading],
  ["issue", taskReading],
  ["survey", formReading],
  ["form", formReading],
  ["group", { tool: "actor_get_group", arg: "group_id", noun: "group", finishes: false }],
  ["group_order", { tool: "market_get_group_order", arg: "groupOrderID", noun: "group order", finishes: false }],
]);

export const mcpReader: Reader = (tool, args) => callTool("", tool, args);

const vanished = /not found|no such|does not exist|404/i;

const isGone = (error: unknown) => error instanceof McpError && !error.unauthorized && vanished.test(error.message);

const readingOf = (n: NotificationItem) => (n.subjectId === "" ? undefined : readings.get(n.subjectKind));

export const isTaskNotice = (n: NotificationItem) => n.event === "task_assigned" && readingOf(n)?.tool === taskReading.tool;

export const stateOf = async (n: NotificationItem, read: Reader = mcpReader): Promise<SubjectState> => {
  const reading = readingOf(n);
  if (!reading) return "unknown";
  try {
    const subject = await read(reading.tool, { [reading.arg]: n.subjectId });
    return reading.finishes && settled.has(String(subject?.status ?? "")) ? "done" : "there";
  } catch (error) {
    return isGone(error) ? "gone" : "unknown";
  }
};

type Opening = {
  read?: Reader;
  markOneRead: (id: string) => unknown;
  navigate: (path: string) => void;
  say: (words: string) => void;
};

export const openChecked = async (n: NotificationItem, path: string, { read = mcpReader, markOneRead, navigate, say }: Opening) => {
  const state = await stateOf(n, read);
  if (!n.read) markOneRead(n.id);
  if (state === "gone") {
    say(`That ${readingOf(n)?.noun ?? "item"} is no longer there.`);
    return;
  }
  say("");
  navigate(path);
};
