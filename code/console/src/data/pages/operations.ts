import type { PageRow } from "../../types";
import type { PageModule, Query } from "../types";
import { activityOn, listActivity } from "./activity";
import { listAlerts } from "./alerts";
import { listNetwork, networkOnline } from "./network";

const overviewDevices = "Devices online";
const overviewRoles = "AI roles switched on";
const overviewAlerts = "Open alerts";
const overviewAttention = "Needs attention";

const shown = (value: unknown) => (value === undefined || value === null ? "" : String(value));

const countWhere = (rows: PageRow[], key: string, want: string) => rows.filter((row) => row[key] === want).length;

const overviewTile = (label: string, value: string, count: number, total: number): PageRow => ({
  id: label,
  kind: "tile",
  area: label,
  detail: value,
  state: "",
  count,
  total,
});

const overviewAttentionRow = (id: string, area: string, detail: string, state: string): PageRow => ({
  id,
  kind: "attention",
  group: overviewAttention,
  area,
  detail,
  state,
});

const listOverview = async (hubId: string, query: Query): Promise<PageRow[]> => {
  const devices = await listNetwork(hubId, {});
  const roles = await listActivity(hubId);
  const alerts = await listAlerts(hubId, { room: query.room, state: "open" });
  const online = countWhere(devices, "state", networkOnline);
  const on = countWhere(roles, "state", activityOn);
  const rows = [
    overviewTile(overviewDevices, `${online} of ${devices.length}`, online, devices.length),
    overviewTile(overviewRoles, `${on} of ${roles.length}`, on, roles.length),
    overviewTile(overviewAlerts, `${alerts.length}`, alerts.length, alerts.length),
  ];
  for (const device of devices) {
    if (device.state === "Fault") rows.push(overviewAttentionRow(shown(device.id), "Network", shown(device.name), "Fault"));
  }
  for (const alert of alerts) {
    rows.push(overviewAttentionRow(shown(alert.id), "Alerts", shown(alert.alert), "Open"));
  }
  return rows;
};

export type Overview = {
  devices: { online: number; total: number };
  roles: { on: number; total: number };
  alerts: number;
  attention: PageRow[];
};

const countOf = (value: unknown) => (typeof value === "number" ? value : 0);

const tileOf = (rows: PageRow[], label: string): PageRow => rows.find((row) => row.kind === "tile" && row.id === label) ?? {};

export const overviewOf = (rows: PageRow[]): Overview => {
  const devices = tileOf(rows, overviewDevices);
  const roles = tileOf(rows, overviewRoles);
  const alerts = tileOf(rows, overviewAlerts);
  return {
    devices: { online: countOf(devices.count), total: countOf(devices.total) },
    roles: { on: countOf(roles.count), total: countOf(roles.total) },
    alerts: countOf(alerts.count),
    attention: rows.filter((row) => row.kind === "attention"),
  };
};

export const operationsPage: PageModule = {
  spec: {
    id: "operations",
    title: "Operations",
    primary: "",
    tools: [
      "digitaltwin_node_list",
      "digitaltwin_observation_latest",
      "ai_list_roles",
      "comm_chat_thread_list",
      "comm_chat_message_list",
    ],
    columns: [
      { key: "area", label: "Area" },
      { key: "detail", label: "Detail" },
      { key: "state", label: "State" },
    ],
  },
  rows: listOverview,
};
