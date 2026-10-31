import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { ActionResult } from "../types";
import { itemsOf, proposeWrite, textOf } from "./groups";

export const raciLabels = ["responsible", "accountable", "consulted", "informed"] as const;

export type RaciLabel = (typeof raciLabels)[number];

export type StepAssignment = { id: string; roleId: string; label: RaciLabel };

export type StepRoleRow = { roleId: string; assignments: Partial<Record<RaciLabel, string>> };

const labelOf = (value: string): RaciLabel | null => raciLabels.find((label) => label === value.toLowerCase()) ?? null;

export const loadStepAssignments = async (hubId: string, workItemId: string): Promise<StepAssignment[]> => {
  const scope = await draftScope(hubId);
  const listed = itemsOf(await callTool<unknown>(hubId, "agency_list_role_assignments_for_work_item", { ...scope, work_item_id: workItemId }));
  return listed.flatMap((item) => {
    const label = labelOf(textOf(item, "label"));
    const id = textOf(item, "id");
    const roleId = textOf(item, "role_id");
    return label && id && roleId ? [{ id, roleId, label }] : [];
  });
};

export const rowsOfStep = (assignments: StepAssignment[]): StepRoleRow[] => {
  const rows = new Map<string, StepRoleRow>();
  for (const assignment of assignments) {
    const row = rows.get(assignment.roleId) ?? { roleId: assignment.roleId, assignments: {} };
    row.assignments[assignment.label] = assignment.id;
    rows.set(assignment.roleId, row);
  }
  return [...rows.values()];
};

export const proposeAddStepRole = (
  hubId: string,
  workItemId: string,
  step: string,
  roleId: string,
  role: string,
  label: RaciLabel,
): Promise<ActionResult> =>
  proposeWrite(hubId, "agency_set_raci", "Put " + role + " on the step " + step + " as " + label, {
    work_item_id: workItemId,
    role_id: roleId,
    label,
  });

export const proposeRemoveStepRole = (hubId: string, assignmentId: string, step: string, role: string, label: RaciLabel): Promise<ActionResult> =>
  proposeWrite(hubId, "agency_delete_role_assignment", "Take " + role + " off the step " + step + " as " + label, { assignment_id: assignmentId });
