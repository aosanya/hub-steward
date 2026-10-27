import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import type { PageModule, Query } from "../types";
import { asObject, idOf, roleItems, text, toolMissing, type Item } from "./agents";

export const networkOnline = "Online";

const capitalised = (status: string) => (status === "" ? "" : status.charAt(0).toUpperCase() + status.slice(1));

const networkRow = (node: Item): PageRow => ({
  id: idOf(node),
  name: node.name,
  type: text(node.kind),
  state: capitalised(text(node.status)),
});

const networkLastSeen = async (hubId: string, nodeId: string): Promise<string> => {
  try {
    const raw = await callTool(hubId, "digitaltwin_observation_latest", { node_id: nodeId });
    return text(asObject(raw, "digitaltwin_observation_latest").observed_at);
  } catch {
    return "";
  }
};

const withoutTwin = async (read: () => Promise<PageRow[]>): Promise<PageRow[]> => {
  try {
    return await read();
  } catch (failure) {
    if (toolMissing(failure)) return [];
    throw failure;
  }
};

const networkTerminals = async (hubId: string, deviceId: string): Promise<PageRow[]> => {
  const links = roleItems(await callTool(hubId, "digitaltwin_link_list", { node_id: deviceId }));
  const rows: PageRow[] = [];
  for (const link of links) {
    const to = text(link.to_node_id);
    if (text(link.from_node_id) !== deviceId || to === "") continue;
    const node = asObject(await callTool(hubId, "digitaltwin_node_read", { node_id: to }), "digitaltwin_node_read");
    rows.push(networkRow(node));
  }
  return rows;
};

const networkDevices = async (hubId: string): Promise<PageRow[]> => {
  const nodes = roleItems(await callTool(hubId, "digitaltwin_node_list"));
  const rows: PageRow[] = [];
  for (const node of nodes) {
    rows.push({ ...networkRow(node), last_seen: await networkLastSeen(hubId, text(node.id)) });
  }
  return rows;
};

export const listNetwork = (hubId: string, query: Query): Promise<PageRow[]> =>
  withoutTwin(() => (query.device ? networkTerminals(hubId, query.device) : networkDevices(hubId)));

export const networkPage: PageModule = {
  spec: {
    id: "network",
    title: "Network",
    primary: "",
    tools: ["digitaltwin_node_list", "digitaltwin_node_read", "digitaltwin_link_list", "digitaltwin_observation_latest"],
    columns: [
      { key: "name", label: "Device" },
      { key: "type", label: "Type" },
      { key: "state", label: "State" },
      { key: "last_seen", label: "Last seen" },
    ],
  },
  rows: listNetwork,
};
