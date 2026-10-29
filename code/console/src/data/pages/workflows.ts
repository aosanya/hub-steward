import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { ActionResult, PageModule, Query } from "../types";
import { isRecord, proposeWrite, textOf, type Item } from "./groups";

const orderedItems = (answer: unknown): Item[] => {
  if (answer === null || answer === undefined) return [];
  if (Array.isArray(answer)) return answer.filter(isRecord);
  if (isRecord(answer) && Array.isArray(answer.items)) return answer.items.filter(isRecord);
  throw new Error("the answer was not a list");
};

const workflowOf = (answer: unknown): Item | null => {
  if (answer === null || answer === undefined) return null;
  if (isRecord(answer)) return answer;
  throw new Error("the answer was not a workflow");
};

const stepsOf = (items: Item[], workflowId: string): Item[] => items.filter((item) => textOf(item, "workflow_id") === workflowId);

const objectivesOf = (links: Item[], workflowId: string): string[] => [
  ...new Set(links.filter((link) => textOf(link, "workflow_id") === workflowId).map((link) => textOf(link, "objective_id")).filter(Boolean)),
];

const roleNameOf = (step: Item, names: Map<string, string>): string[] => {
  const id = textOf(step, "role_id");
  if (id === "") return [""];
  const name = names.get(id);
  return name ? [name] : [];
};

const rolesOf = (steps: Item[], names: Map<string, string>): string[] => [
  ...new Set([...steps].sort((a, b) => (Number(a.ordinality) || 0) - (Number(b.ordinality) || 0)).flatMap((step) => roleNameOf(step, names))),
];

const roleNamesOf = (pickers: unknown): Map<string, string> =>
  new Map(
    isRecord(pickers) && Array.isArray(pickers.actors)
      ? pickers.actors
          .filter(isRecord)
          .flatMap((actor) => (textOf(actor, "kind") === "role" ? [[textOf(actor, "id"), textOf(actor, "name")] as [string, string]] : []))
      : [],
  );

const chatsWithOf = (workflow: Item, steps: Item[], names: Map<string, string>): { chats_with?: string } => {
  if (textOf(workflow, "opens_in") !== "chat") return {};
  const chat = steps.find((step) => textOf(step, "kind") === "chat");
  return { chats_with: (chat && names.get(textOf(chat, "agent_role_id"))) || "" };
};

const workflowList = async (hubId: string, query: Query): Promise<PageRow[]> => {
  const scope = await draftScope(hubId, query);
  const [workflows, items, links, defaults, pickers] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_workflows", scope),
    callTool<unknown>(hubId, "agency_list_work_items", scope),
    callTool<unknown>(hubId, "agency_list_workflow_objectives", scope).then(orderedItems),
    callTool<unknown>(hubId, "agency_list_default_workflows", {}).then(orderedItems, () => []),
    callTool<unknown>(hubId, "agency_list_pickers", scope).catch(() => null),
  ]);
  const names = roleNamesOf(pickers);
  const all = orderedItems(items);
  const own = orderedItems(workflows).map((workflow) => {
    const steps = stepsOf(all, textOf(workflow, "id"));
    return {
      ...workflow,
      steps: steps.length,
      objectives: objectivesOf(links, textOf(workflow, "id")),
      roles: pickers === null ? [] : rolesOf(steps, names),
      ...chatsWithOf(workflow, steps, names),
    };
  });
  const owned = new Set(own.map((workflow) => textOf(workflow, "code")));
  const builtIn = defaults.filter((workflow) => !owned.has(textOf(workflow, "code"))).map((workflow) => ({ ...workflow, default: true, objectives: [] }));
  return [...own, ...builtIn];
};

const workflowDetail = async (hubId: string, workflowId: string, query: Query): Promise<PageRow[]> => {
  const scope = await draftScope(hubId, query);
  const [workflow, items, links] = await Promise.all([
    callTool<unknown>(hubId, "agency_get_workflow", { workflow_id: workflowId }),
    callTool<unknown>(hubId, "agency_list_work_items", scope),
    callTool<unknown>(hubId, "agency_list_workflow_objectives", { ...scope, workflow_id: workflowId }),
  ]);
  return [{ workflow: workflowOf(workflow), steps: stepsOf(orderedItems(items), workflowId), links: orderedItems(links) }];
};

export type ObjectiveChoice = { id: string; code: string; title: string };

export const objectiveChoices = async (hubId: string): Promise<ObjectiveChoice[]> =>
  orderedItems(await callTool<unknown>(hubId, "agency_list_objectives", await draftScope(hubId))).map((objective) => ({
    id: textOf(objective, "id"),
    code: textOf(objective, "code"),
    title: textOf(objective, "title"),
  }));

export const objectiveName = (objective: ObjectiveChoice): string => [objective.code, objective.title].filter(Boolean).join(" ") || objective.id;

export const proposeLinkObjective = async (hubId: string, workflowId: string, workflowName: string, objective: ObjectiveChoice): Promise<ActionResult> =>
  proposeWrite(hubId, "agency_link_workflow_objective", "Link the objective " + objectiveName(objective) + " to the workflow " + workflowName, {
    workflow_id: workflowId,
    objective_id: objective.id,
    ...(await draftScope(hubId)),
  });

export const proposeUnlinkObjective = (hubId: string, linkId: string, workflowName: string, objective: ObjectiveChoice): Promise<ActionResult> =>
  proposeWrite(hubId, "agency_delete_workflow_objective", "Unlink the objective " + objectiveName(objective) + " from the workflow " + workflowName, {
    workflow_objective_id: linkId,
  });

const rows = async (hubId: string, query: Query): Promise<PageRow[]> =>
  query.workflow ? workflowDetail(hubId, query.workflow, query) : workflowList(hubId, query);

export const workflowsPage: PageModule = {
  spec: {
    id: "workflows",
    title: "Workflows",
    primary: "Add a workflow",
    tools: ["agency_list_workflows", "agency_get_workflow", "agency_list_default_workflows", "agency_list_work_items", "agency_list_workflow_objectives", "agency_list_objectives"],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Workflow" },
      { key: "description", label: "What it is for" },
      { key: "steps", label: "Steps" },
    ],
  },
  rows,
};
