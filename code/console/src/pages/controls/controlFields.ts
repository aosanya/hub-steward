import { callTool } from "../../wakala/mcp";
import { draftScope } from "../../data/draft";
import { itemsOf, textOf } from "../../data/pages/groups";

export type ControlFields = {
  text: string;
  action: string;
  cond_field: string;
  cond_operator: string;
  cond_value: string;
  on_breach: string;
  workflow_id: string;
  severity: string;
};

export type WorkflowChoice = { id: string; name: string };

export const blankFields: ControlFields = {
  text: "",
  action: "",
  cond_field: "",
  cond_operator: "",
  cond_value: "",
  on_breach: "",
  workflow_id: "",
  severity: "",
};

export const runWorkflowAction = "run_workflow";

export const listWorkflowChoices = async (hubId: string): Promise<WorkflowChoice[]> =>
  itemsOf(await callTool<unknown>(hubId, "agency_list_workflows", await draftScope(hubId))).map((item) => ({
    id: textOf(item, "id"),
    name: textOf(item, "name") || textOf(item, "code"),
  }));

export const loadControlFields = async (hubId: string, controlId: string): Promise<{ code: string; fields: ControlFields } | null> => {
  const items = itemsOf(await callTool<unknown>(hubId, "agency_list_controls", await draftScope(hubId)));
  const item = items.find((candidate) => textOf(candidate, "id") === controlId);
  if (!item) return null;
  const fields = { ...blankFields };
  for (const name of Object.keys(fields) as (keyof ControlFields)[]) fields[name] = textOf(item, name);
  return { code: textOf(item, "code"), fields };
};
