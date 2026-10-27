import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import type { PageModule } from "../types";
import { idOf, roleItems } from "./agents";

export const activityOn = "Switched on";
const activityOff = "Switched off";

export const listActivity = async (hubId: string): Promise<PageRow[]> => {
  const roles = roleItems(await callTool(hubId, "ai_list_roles"));
  return roles.map((role) => ({
    id: idOf(role),
    name: role.name,
    state: role.status === "enabled" ? activityOn : activityOff,
  }));
};

export const activityPage: PageModule = {
  spec: {
    id: "activity",
    title: "Activity",
    primary: "",
    tools: ["ai_list_roles"],
    columns: [
      { key: "name", label: "Agent" },
      { key: "state", label: "State" },
    ],
  },
  rows: (hubId) => listActivity(hubId),
};
