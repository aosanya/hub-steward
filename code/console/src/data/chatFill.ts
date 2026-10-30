import { hubPath } from "../api";
import type { ActorFill, FormAnswer, FormFill, ProfileFill, ScenarioFill, StepFill, Suggestion, SuggestionStep, SuggestionsFill, WorkflowFill } from "./chatAnswer";
import type { ActorDraft, RoleChoice, WorkflowChoice } from "./scenario";
import { emptyStep, stepKinds, type Choice, type StepKind, type WorkflowDraft } from "./pages/workflowDesign";

type Args = Record<string, unknown>;

const isObject = (value: unknown): value is Args => typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const objectsOf = (value: unknown): Args[] => (Array.isArray(value) ? value.filter(isObject) : []);

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

const stepOf = (item: Args): StepFill => ({ name: textOf(item.name), role: textOf(item.role), kind: textOf(item.kind) });

const actorOf = (item: Args): ActorFill => ({ name: textOf(item.name), role: textOf(item.role) });

export const workflowFillOf = (args: Args): WorkflowFill => ({
  name: textOf(args.name),
  description: textOf(args.description),
  cancel: args.cancel === true,
  steps: objectsOf(args.steps).map(stepOf).filter((step) => step.name !== ""),
});

export const profileFillOf = (args: Args): ProfileFill => ({ name: textOf(args.name), purpose: textOf(args.purpose) });

export const scenarioFillOf = (args: Args): ScenarioFill => ({
  name: textOf(args.name),
  summary: textOf(args.summary),
  workflow: textOf(args.workflow),
  actors: objectsOf(args.actors).map(actorOf).filter((actor) => actor.name !== ""),
});

const isStepKind = (value: string): value is StepKind => (stepKinds as readonly string[]).includes(value);

export function applyWorkflowFill(base: WorkflowDraft, fill: WorkflowFill, roles: Choice[]): WorkflowDraft {
  const steps = fill.steps.map((step) => ({
    ...emptyStep(isStepKind(step.kind) ? step.kind : "fill_form"),
    name: step.name,
    roleId: roles.find((role) => same(role.label, step.role))?.value ?? "",
  }));
  return { ...base, name: fill.name, description: fill.description, steps: [...base.steps, ...steps] };
}

export type ScenarioFilled = { workflowId: string; actors: ActorDraft[] };

export function applyScenarioFill(fill: ScenarioFill, workflows: WorkflowChoice[], roles: RoleChoice[]): ScenarioFilled {
  const actors = fill.actors.flatMap((actor) => {
    const role = roles.find((entry) => same(entry.name, actor.role));
    return role ? [{ name: actor.name, roleId: role.id }] : [];
  });
  return { workflowId: workflows.find((workflow) => same(workflow.name, fill.workflow))?.id ?? "", actors };
}

const changeOf = (item: Args, allowed: string[]): SuggestionStep => {
  const tool = textOf(item.tool);
  return { tool: allowed.includes(tool) ? tool : "", arguments: isObject(item.arguments) ? item.arguments : {} };
};

const suggestionOf = (item: Args, allowed: string[]): Suggestion => {
  const first = changeOf(item, allowed);
  const then = first.tool === "" ? [] : objectsOf(item.then).map((step) => changeOf(step, allowed)).filter((step) => step.tool !== "");
  return { title: textOf(item.title), detail: textOf(item.detail), ...first, then };
};

export const suggestionsFillOf = (page: string, args: Args, allowed: string[]): SuggestionsFill => ({
  page,
  summary: textOf(args.summary),
  items: objectsOf(args.suggestions)
    .map((item) => suggestionOf(item, allowed))
    .filter((item) => item.title !== ""),
});

export type FormTarget = { to: string; state: { chatFill: FormFill } };

export function formTarget(hubId: string, answer: FormAnswer): FormTarget {
  const state = { chatFill: { form: answer.form, fill: answer.fill } as FormFill };
  if (answer.form === "profile") return { to: hubPath(hubId, "profile"), state };
  if (answer.form === "scenario") return { to: hubPath(hubId, "test") + "?add=1", state };
  return { to: hubPath(hubId, "workflow-edit", "new", "workflow") + (answer.fill.cancel ? "?cancel=1" : ""), state };
}

export function workflowFillIn(state: unknown): WorkflowFill | null {
  const carried = isObject(state) && isObject(state.chatFill) ? state.chatFill : null;
  return carried && carried.form === "workflow" && isObject(carried.fill) ? workflowFillOf(carried.fill) : null;
}

export function scenarioFillIn(state: unknown): ScenarioFill | null {
  const carried = isObject(state) && isObject(state.chatFill) ? state.chatFill : null;
  return carried && carried.form === "scenario" && isObject(carried.fill) ? scenarioFillOf(carried.fill) : null;
}

export function profileFillIn(state: unknown): ProfileFill | null {
  const carried = isObject(state) && isObject(state.chatFill) ? state.chatFill : null;
  return carried && carried.form === "profile" && isObject(carried.fill) ? profileFillOf(carried.fill) : null;
}

export type ObjectivePlan = { title: string; description: string };

export type GoalPlan = { title: string; description: string; objectives: ObjectivePlan[] };

const objectivePlanOf = (item: Args): ObjectivePlan => ({ title: textOf(item.title), description: textOf(item.description) });

export const goalPlansOf = (args: Args): GoalPlan[] =>
  objectsOf(args.goals)
    .map((item) => ({ title: textOf(item.title), description: textOf(item.description), objectives: objectsOf(item.objectives).map(objectivePlanOf).filter((objective) => objective.title !== "") }))
    .filter((goal) => goal.title !== "");
