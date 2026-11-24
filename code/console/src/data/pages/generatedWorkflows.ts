import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import { isRecord, itemsOf, textOf, type Item } from "./groups";
import { permissionsOf } from "./roles";
import { holdersOf, type HoldingField, type HoldingRole } from "./stepHolders";

export type GeneratedAction = "add" | "edit" | "delete";

export const generatedActions: GeneratedAction[] = ["add", "edit", "delete"];

export type DesignedRef = { id: string; code: string; name: string };

export type GeneratedRecord = { id: string; code: string; name: string; itemName: string; heldBy: Record<GeneratedAction, string[]> };

export type GeneratedWorkflow = {
  id: string;
  code: string;
  name: string;
  action: GeneratedAction;
  record: GeneratedRecord;
  heldBy: string[];
  replacedBy: DesignedRef | null;
};

export type GeneratedSet = {
  workflows: GeneratedWorkflow[];
  records: GeneratedRecord[];
  designed: DesignedRef[];
  roleNames: Map<string, string>;
};

export type GeneratedStep = {
  id: string;
  name: string;
  kind: string;
  actor: string;
  record: GeneratedRecord | null;
  rowAction: string;
  formName: string;
  questions: string[];
};

export type UsedBy = { workflow: DesignedRef; place: number };

export type GeneratedDetail = { workflow: GeneratedWorkflow; steps: GeneratedStep[]; usedBy: UsedBy[]; set: GeneratedSet };

const isAction = (value: string): value is GeneratedAction => (generatedActions as string[]).includes(value);

const actionOfCode = (code: string): GeneratedAction | null => {
  const action = code.slice(code.lastIndexOf(".") + 1);
  return isAction(action) ? action : null;
};

const fieldsOf = (record: Item): HoldingField[] =>
  (Array.isArray(record.questions) ? record.questions : []).filter(isRecord).map((question) => ({ code: textOf(question, "code"), required: question.required === true }));

const holdingRoleOf = (role: Item): HoldingRole => ({ name: textOf(role, "name"), permissions: permissionsOf(role) });

const recordOf = (raw: Item, roles: HoldingRole[]): GeneratedRecord => {
  const code = textOf(raw, "code");
  const fields = fieldsOf(raw);
  return {
    id: textOf(raw, "id"),
    code,
    name: textOf(raw, "name"),
    itemName: textOf(raw, "item_name"),
    heldBy: { add: holdersOf(code, fields, "add", roles), edit: holdersOf(code, fields, "edit", roles), delete: holdersOf(code, fields, "delete", roles) },
  };
};

const unknownRecord = (code: string): GeneratedRecord => ({ id: "", code, name: code, itemName: "", heldBy: { add: [], edit: [], delete: [] } });

const refOf = (raw: Item): DesignedRef => ({ id: textOf(raw, "id"), code: textOf(raw, "code"), name: textOf(raw, "name") });

export const isGenerated = (workflow: Item): boolean => workflow.generated === true;

export const designedWorkflowOf = (designed: DesignedRef[], key: string): DesignedRef | null =>
  key === "" ? null : (designed.find((one) => one.code === key || one.id === key) ?? { id: "", code: key, name: key });

export const loadGenerated = async (hubId: string): Promise<GeneratedSet> => {
  const scope = await draftScope(hubId);
  const [workflows, records, roles] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_workflows", scope),
    callTool<unknown>(hubId, "agency_list_records", scope),
    callTool<unknown>(hubId, "agency_list_roles", scope),
  ]);
  const roleNames = new Map(itemsOf(roles).map((role) => [textOf(role, "id"), textOf(role, "name")]));
  const holding = itemsOf(roles).map(holdingRoleOf);
  const known = itemsOf(records).map((record) => recordOf(record, holding));
  const all = itemsOf(workflows);
  const designed = all.filter((workflow) => !isGenerated(workflow)).map(refOf);
  const made = all.flatMap((workflow): GeneratedWorkflow[] => {
    if (!isGenerated(workflow)) return [];
    const code = textOf(workflow, "code");
    const action = actionOfCode(code);
    if (action === null) return [];
    const forCode = textOf(workflow, "generated_for");
    const record = known.find((one) => one.code === forCode) ?? unknownRecord(forCode);
    return [
      {
        id: textOf(workflow, "id"),
        code,
        name: textOf(workflow, "name"),
        action,
        record,
        heldBy: record.heldBy[action],
        replacedBy: designedWorkflowOf(designed, textOf(workflow, "replaced_by")),
      },
    ];
  });
  return { workflows: made, records: known, designed, roleNames };
};

export type RecordSlot = { record: GeneratedRecord; action: GeneratedAction; code: string; workflow: GeneratedWorkflow | null };

export const slotsOf = (set: GeneratedSet, record: GeneratedRecord): RecordSlot[] =>
  generatedActions.map((action) => ({
    record,
    action,
    code: `${record.code}.${action}`,
    workflow: set.workflows.find((workflow) => workflow.record.code === record.code && workflow.action === action) ?? null,
  }));


const byPlace = (a: Item, b: Item) => (Number(a.ordinality) || 0) - (Number(b.ordinality) || 0);

const questionsOf = (step: Item): string[] =>
  (Array.isArray(step.questions) ? step.questions : []).map((question) => textOf(question, "prompt")).filter(Boolean);

export const loadGeneratedDetail = async (hubId: string, workflowId: string): Promise<GeneratedDetail | null> => {
  const [set, items] = await Promise.all([loadGenerated(hubId), callTool<unknown>(hubId, "agency_list_work_items", await draftScope(hubId))]);
  const workflow = set.workflows.find((one) => one.id === workflowId);
  if (!workflow) return null;
  const all = itemsOf(items).sort(byPlace);
  const steps = all
    .filter((step) => textOf(step, "workflow_id") === workflowId)
    .map((step): GeneratedStep => {
      const key = textOf(step, "row_record");
      return {
        id: textOf(step, "id"),
        name: textOf(step, "title"),
        kind: textOf(step, "kind"),
        actor: set.roleNames.get(textOf(step, "role_id")) ?? "",
        record: key === "" ? null : (set.records.find((record) => record.code === key || record.id === key) ?? unknownRecord(key)),
        rowAction: textOf(step, "row_action"),
        formName: textOf(step, "form_name"),
        questions: questionsOf(step),
      };
    });
  const usedBy = set.designed.flatMap((designed) =>
    all
      .filter((step) => textOf(step, "workflow_id") === designed.id)
      .flatMap((step, index) => (textOf(step, "run_workflow_id") === workflowId ? [{ workflow: designed, place: index + 1 }] : [])),
  );
  return { workflow, steps, usedBy, set };
};
