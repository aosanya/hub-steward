import { callTool } from "../../wakala/mcp";
import type { ActionResult } from "../types";
import { proposeWrite, textOf, type Item } from "./groups";

export type StepAccountable = { accountableRoleId: string; ownRoleId: string };

export const loadStepAccountable = async (hubId: string, workItemId: string): Promise<StepAccountable> => {
  const step = await callTool<Item>(hubId, "agency_get_work_item", { work_item_id: workItemId });
  return { accountableRoleId: textOf(step, "accountable_role_id"), ownRoleId: textOf(step, "role_id") };
};

export const effectiveRoleId = (step: StepAccountable): string => step.accountableRoleId || step.ownRoleId;

export const proposeSetAccountableRole = (
  hubId: string,
  workItemId: string,
  step: string,
  roleId: string,
  role: string,
): Promise<ActionResult> =>
  proposeWrite(hubId, "agency_update_work_item", "Make " + role + " accountable for the step " + step, {
    work_item_id: workItemId,
    accountable_role_id: roleId,
  });

export const proposeClearAccountableRole = (hubId: string, workItemId: string, step: string): Promise<ActionResult> =>
  proposeWrite(hubId, "agency_update_work_item", "Take the accountable role off the step " + step, {
    work_item_id: workItemId,
    accountable_role_id: "",
  });
