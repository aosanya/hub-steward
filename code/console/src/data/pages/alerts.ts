import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import type { PageModule, Query } from "../types";
import { roleItems, text, type Item } from "./agents";

const alertThreadLabel = "Network alerts";

const alertStates = new Map([
  ["open", "Open"],
  ["closed", "Closed"],
]);

const firstLine = (body: string) => body.split("\n")[0].trim();

const itemOf = (value: unknown): Item => (typeof value === "object" && value !== null ? (value as Item) : {});

const alertRows = (raw: unknown, want: string): PageRow[] => {
  const items = itemOf(raw).items;
  const state = "Open";
  if (!Array.isArray(items) || (want !== "" && want !== state)) return [];
  return items.map(itemOf).map((message) => ({
    id: text(message.id),
    alert: firstLine(text(message.body)),
    state,
    raised: text(message.created_at),
    message: text(message.body),
  }));
};

export const listAlerts = async (hubId: string, query: Query): Promise<PageRow[]> => {
  let want = "";
  if (query.state) {
    const label = alertStates.get(query.state);
    if (label === undefined) return [];
    want = label;
  }
  const room = query.room;
  if (!room) return [];
  const threads = roleItems(await callTool(hubId, "comm_chat_thread_list", { structure_id: room }));
  const rows: PageRow[] = [];
  for (const thread of threads) {
    const threadId = text(thread.id);
    if (thread.label !== alertThreadLabel || threadId === "") continue;
    const messages = await callTool(hubId, "comm_chat_message_list", { structure_id: room, thread_id: threadId });
    rows.push(...alertRows(messages, want));
  }
  return rows;
};

export const alertsPage: PageModule = {
  spec: {
    id: "alerts",
    title: "Alerts",
    primary: "",
    tools: ["comm_chat_thread_list", "comm_chat_message_list"],
    columns: [
      { key: "alert", label: "Alert" },
      { key: "state", label: "State" },
      { key: "raised", label: "Raised" },
    ],
  },
  rows: listAlerts,
};
