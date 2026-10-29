import { callTool } from "../../wakala/mcp";
import { itemsOf, textOf } from "./groups";

export type UserTask = { id: string; title: string; status: string; due: string };

export type UserHold = { id: string; quantity: string; status: string; until: string };

export type UserDetailData = { code: string; joined: string; groups: string[]; tasks: UserTask[]; holds: UserHold[] };

const quantityOf = (hold: Record<string, unknown>): string => {
  const quantity = hold.quantity;
  return typeof quantity === "number" || typeof quantity === "string" ? String(quantity) : "";
};

const groupNames = async (hubId: string, actorId: string): Promise<string[]> => {
  const [held, groups] = await Promise.all([
    callTool<unknown>(hubId, "actor_list_groups_for_actor", { actor_id: actorId }),
    callTool<unknown>(hubId, "actor_list_groups", {}),
  ]);
  const names = new Map(itemsOf(groups).map((group) => [textOf(group, "id"), textOf(group, "name")]));
  return itemsOf(held)
    .map((assignment) => names.get(textOf(assignment, "group_id")) ?? "")
    .filter(Boolean);
};

const tasksOf = async (hubId: string, actorId: string): Promise<UserTask[]> => {
  const answer = await callTool<unknown>(hubId, "taskmanager_task_list", {});
  return itemsOf(answer)
    .filter((task) => textOf(task, "assigned_to") === actorId && textOf(task, "assignee_kind") === "actor")
    .map((task) => ({ id: textOf(task, "id"), title: textOf(task, "title"), status: textOf(task, "status"), due: textOf(task, "due_at") }));
};

const holdsOf = async (hubId: string, actorId: string): Promise<UserHold[]> => {
  const answer = await callTool<unknown>(hubId, "assetmanager_hold_list", {});
  return itemsOf(answer)
    .filter((hold) => textOf(hold, "placed_by") === actorId)
    .map((hold) => ({
      id: textOf(hold, "id"),
      quantity: quantityOf(hold),
      status: textOf(hold, "status"),
      until: textOf(hold, "ends_at") || textOf(hold, "expires_at"),
    }));
};

export const loadUserDetail = async (hubId: string, actorId: string): Promise<UserDetailData> => {
  const [actor, groups, tasks, holds] = await Promise.all([
    callTool<unknown>(hubId, "actor_get_actor", { actor_id: actorId }),
    groupNames(hubId, actorId),
    tasksOf(hubId, actorId),
    holdsOf(hubId, actorId),
  ]);
  return { code: textOf(actor, "public_code"), joined: textOf(actor, "created_at"), groups, tasks, holds };
};
