import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import { isRecord, itemsOf, textOf, type Item } from "./groups";

export const stepKinds = ["fill_form", "send_form", "notify", "yes_no", "route", "run_workflow"] as const;
export type StepKind = (typeof stepKinds)[number] | "chat";

export type AnswerType = string;

export const hasOptions = (type: AnswerType) => type === "single_choice" || type === "multi_select";

export const routeOperators = ["is", "is_not", "contains", "more_than", "less_than"] as const;
export type RouteOperator = (typeof routeOperators)[number];

export type QuestionDraft = {
  prompt: string;
  answerType: AnswerType;
  required: boolean;
  helper: string;
  options: string[];
  optionsFrom: string;
  fixed: string;
};

export type RuleDraft = { question: string; operator: RouteOperator; value: string };

export type RouteDraft = { match: "all" | "any"; rules: RuleDraft[]; goTo: string };

export type StepDraft = {
  key: string;
  id: string;
  name: string;
  description: string;
  kind: StepKind;
  roleId: string;
  recipientRoleId: string;
  sentKey: string;
  runWorkflowId: string;
  formName: string;
  questions: QuestionDraft[];
  routes: RouteDraft[];
  otherwiseKey: string;
  prompt: string;
  timeLimit: string;
  cancelWorkflowId: string;
  loaded?: Item;
};

export type RecordDraft = {
  key: string;
  id: string;
  name: string;
  roleId: string;
  viewerRoleId: string;
  formName: string;
  questions: QuestionDraft[];
  loaded?: Item;
};

export type OpensIn = "chat" | "form";

export type WorkflowDraft = {
  id: string;
  name: string;
  description: string;
  opensIn: OpensIn;
  ordersUnderWay: number;
  steps: StepDraft[];
  records: RecordDraft[];
  loaded?: Item;
};

export type Choice = { value: string; label: string };

export type DesignChoices = { roles: Choice[]; workflows: Choice[]; lists: Choice[]; answerTypes: AnswerType[] };

export type Design = { workflow: WorkflowDraft; choices: DesignChoices };

export const agencyKinds: StepKind[] = ["send_form", "route"];

export const takesForm = (kind: StepKind) => kind === "fill_form" || kind === "send_form" || kind === "notify" || kind === "yes_no";

export const waitsOnPerson = (step: StepDraft) => (step.kind === "fill_form" || step.kind === "yes_no") && step.roleId !== "";

export const pointsAtRecipient = (kind: StepKind) => kind === "send_form" || kind === "notify";

let counter = 0;

export const freshKey = () => "new-" + ++counter;

export const emptyQuestion = (): QuestionDraft => ({
  prompt: "",
  answerType: "free_text",
  required: true,
  helper: "",
  options: [],
  optionsFrom: "",
  fixed: "",
});

export const emptyStep = (kind: StepKind = "fill_form"): StepDraft => ({
  key: freshKey(),
  id: "",
  name: "",
  description: "",
  kind,
  roleId: "",
  recipientRoleId: "",
  sentKey: "",
  runWorkflowId: "",
  formName: "",
  questions: takesForm(kind) ? [emptyQuestion()] : [],
  routes: [],
  otherwiseKey: "",
  prompt: "",
  timeLimit: "",
  cancelWorkflowId: "",
});

export const emptyRecord = (): RecordDraft => ({ key: freshKey(), id: "", name: "", roleId: "", viewerRoleId: "", formName: "", questions: [emptyQuestion()] });

export const emptyWorkflow = (): WorkflowDraft => ({ id: "", name: "", description: "", opensIn: "form", ordersUnderWay: 0, steps: [], records: [] });

const lowerFirst = (text: string) => (text === "" ? text : text[0].toLowerCase() + text.slice(1));

export const actionOf = (step: StepDraft, steps: StepDraft[], workflows: Choice[]): string => {
  const sent = steps.find((other) => other.key === step.sentKey);
  if (step.kind === "yes_no" && sent) return "Answers the " + lowerFirst(sent.formName || sent.name);
  const form = step.formName || step.name;
  switch (step.kind) {
    case "fill_form":
      return "Fills the " + form;
    case "send_form":
      return "Sends the " + lowerFirst(form);
    case "notify":
      return "Notifies with the " + lowerFirst(form);
    case "yes_no":
      return "Gives " + lowerFirst(form);
    case "route":
      return "Routes the answers";
    case "chat":
      return "Chats with an agent";
    default:
      return "Starts " + (workflows.find((workflow) => workflow.value === step.runWorkflowId)?.label ?? "");
  }
};

const isKind = (value: string): value is StepKind => value === "chat" || (stepKinds as readonly string[]).includes(value);

const isOperator = (value: string): value is RouteOperator => (routeOperators as readonly string[]).includes(value);

const listOf = (value: unknown): Item[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const textsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

const questionOf = (raw: Item): QuestionDraft => {
  return {
    prompt: textOf(raw, "prompt"),
    answerType: textOf(raw, "answer_type") || "free_text",
    required: raw.required === true,
    helper: textOf(raw, "helper"),
    options: textsOf(raw.options),
    optionsFrom: textOf(raw, "options_from"),
    fixed: textOf(raw, "fixed"),
  };
};

const minutesOf = (value: unknown): string => (typeof value === "number" && Number.isInteger(value) && value > 0 ? String(value) : "");

const stepOf = (raw: Item): StepDraft => {
  const kind = textOf(raw, "kind");
  const id = textOf(raw, "id");
  return {
    key: id,
    id,
    name: textOf(raw, "title"),
    description: textOf(raw, "description"),
    kind: isKind(kind) ? kind : "fill_form",
    roleId: textOf(raw, "role_id"),
    recipientRoleId: textOf(raw, "recipient_role_id"),
    sentKey: textOf(raw, "sent_step_id"),
    runWorkflowId: textOf(raw, "run_workflow_id"),
    formName: textOf(raw, "form_name"),
    questions: listOf(raw.questions).map(questionOf),
    routes: listOf(raw.routes).map((route) => ({
      match: textOf(route, "match") === "any" ? "any" : "all",
      rules: listOf(route.rules).map((rule) => {
        const operator = textOf(rule, "operator");
        return { question: textOf(rule, "question"), operator: isOperator(operator) ? operator : "is", value: textOf(rule, "value") };
      }),
      goTo: textOf(route, "go_to_step_id"),
    })),
    otherwiseKey: textOf(raw, "otherwise_step_id"),
    prompt: textOf(raw, "prompt"),
    timeLimit: minutesOf(raw.time_limit_minutes),
    cancelWorkflowId: textOf(raw, "cancel_workflow_id"),
    loaded: raw,
  };
};

const recordOf = (raw: Item): RecordDraft => {
  const id = textOf(raw, "id");
  return {
    key: id,
    id,
    name: textOf(raw, "name"),
    roleId: textOf(raw, "role_id"),
    viewerRoleId: textOf(raw, "viewer_role_id"),
    formName: textOf(raw, "form_name"),
    questions: listOf(raw.questions).map(questionOf),
    loaded: raw,
  };
};

const byPlace = (a: Item, b: Item) => (Number(a.ordinality) || 0) - (Number(b.ordinality) || 0);

const choicesOf = (items: Item[], label: string): Choice[] =>
  items.map((item) => ({ value: textOf(item, "id"), label: textOf(item, label) })).filter((choice) => choice.value !== "");

export async function loadDesign(hubId: string, workflowId: string | null): Promise<Design> {
  const scope = await draftScope(hubId);
  const [pickers, workflows] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_pickers", scope),
    callTool<unknown>(hubId, "agency_list_workflows", scope),
  ]);
  const actors = isRecord(pickers) ? listOf(pickers.actors) : [];
  const ofKind = (kind: string) => actors.filter((actor) => textOf(actor, "kind") === kind);
  const roleChoices = choicesOf(ofKind("role"), "name");
  const groupNames = ofKind("group")
    .map((group) => textOf(group, "name"))
    .filter(Boolean);
  const lists: Choice[] = [...roleChoices.map((role) => role.label), ...groupNames].map((name) => ({ value: name, label: name }));
  const answerTypes = isRecord(pickers) ? textsOf(pickers.answer_types) : [];
  const choices: DesignChoices = {
    roles: roleChoices,
    workflows: choicesOf(itemsOf(workflows), "name"),
    lists,
    answerTypes,
  };
  if (workflowId === null) return { workflow: emptyWorkflow(), choices };

  const [workflow, items, records] = await Promise.all([
    callTool<unknown>(hubId, "agency_get_workflow", { workflow_id: workflowId }),
    callTool<unknown>(hubId, "agency_list_work_items", scope),
    callTool<unknown>(hubId, "agency_list_records", scope),
  ]);
  if (!isRecord(workflow)) throw new Error("the answer was not a workflow");
  const steps = itemsOf(items)
    .filter((item) => textOf(item, "workflow_id") === workflowId)
    .sort(byPlace)
    .map(stepOf);
  return {
    workflow: {
      id: workflowId,
      name: textOf(workflow, "name"),
      description: textOf(workflow, "description"),
      opensIn: textOf(workflow, "opens_in") === "chat" ? "chat" : "form",
      ordersUnderWay: Number(workflow.orders_under_way) || 0,
      steps,
      records: itemsOf(records)
        .filter((record) => textOf(record, "workflow_id") === workflowId)
        .map(recordOf),
      loaded: workflow,
    },
    choices,
  };
}

const questionBody = (question: QuestionDraft) => ({
  prompt: question.prompt.trim(),
  answer_type: question.answerType,
  required: question.required,
  helper: question.helper.trim(),
  options: hasOptions(question.answerType) && question.optionsFrom === "" ? question.options.map((option) => option.trim()).filter(Boolean) : [],
  options_from: hasOptions(question.answerType) ? question.optionsFrom : "",
  fixed: question.fixed.trim(),
});

const formNameOf = (step: StepDraft) => (step.formName || (step.name.trim() ? step.name.trim() + " form" : ""));

const ownsForm = (step: StepDraft) => takesForm(step.kind) && !(step.kind === "yes_no" && step.sentKey !== "");

const limitedMinutes = (step: StepDraft): number => (waitsOnPerson(step) && step.timeLimit.trim() !== "" ? Number(step.timeLimit.trim()) : 0);

export const limitProblem = (steps: StepDraft[]): "number" | "workflow" | null => {
  for (const step of steps) {
    if (!waitsOnPerson(step) || step.timeLimit.trim() === "") continue;
    if (!/^[1-9][0-9]*$/.test(step.timeLimit.trim())) return "number";
    if (step.cancelWorkflowId === "") return "workflow";
  }
  return null;
};

const agencyOwned = ["id", "code", "created_at", "last_updated", "deleted", "default", "in_use", "version", "orders_under_way", "order_versions", "action"];

const carriedFrom = (loaded: Item | undefined): Item => Object.fromEntries(Object.entries(loaded ?? {}).filter(([key]) => !agencyOwned.includes(key)));

const stepBody = (step: StepDraft, ids: Map<string, string>, place: number, base: Item, creating = false, nextKey = "") => ({
  ...base,
  title: step.name.trim(),
  description: step.description.trim(),
  ordinality: place,
  prompt: step.prompt,
  kind: step.kind,
  role_id: agencyKinds.includes(step.kind) ? "" : step.roleId,
  run_workflow_id: step.kind === "run_workflow" ? step.runWorkflowId : "",
  form_name: ownsForm(step) ? formNameOf(step) : "",
  questions: ownsForm(step) ? step.questions.map(questionBody) : [],
  recipient_role_id: pointsAtRecipient(step.kind) ? step.recipientRoleId : "",
  sent_step_id: step.kind === "yes_no" || (step.kind === "route" && !creating) ? (ids.get(step.sentKey) ?? "") : "",
  routes:
    step.kind === "route" && !creating
      ? step.routes.map((route) => ({
          match: route.match,
          rules: route.rules.map((rule) => ({ question: rule.question, operator: rule.operator, value: rule.value.trim() })),
          go_to_step_id: ids.get(route.goTo || nextKey) ?? "",
        }))
      : [],
  otherwise_step_id: step.kind === "route" && !creating ? (ids.get(step.otherwiseKey) ?? "") : "",
  time_limit_minutes: limitedMinutes(step),
  cancel_workflow_id: limitedMinutes(step) > 0 ? step.cancelWorkflowId : "",
});

const workflowCarried = (loaded: Item | undefined): Item => Object.fromEntries(Object.entries(carriedFrom(loaded)).filter(([key]) => key !== "opens_in"));

const hasLinks = (step: StepDraft) => step.kind === "route" || (step.kind === "yes_no" && step.sentKey !== "");

export const workingDraft = async (hubId: string): Promise<string> => {
  const scope = await draftScope(hubId);
  if (scope.draft_id) return scope.draft_id;
  const made = await callTool<unknown>(hubId, "agency_create_draft", { description: "Changes made in the console" });
  const id = textOf(made, "id");
  if (!id) throw new Error("the draft could not be started");
  return id;
};

const idOf = (made: unknown, what: string): string => {
  const id = textOf(made, "id");
  if (!id) throw new Error(what + " was not given an id");
  return id;
};

export async function saveDesign(hubId: string, before: WorkflowDraft, after: WorkflowDraft): Promise<string> {
  if (!after.name.trim()) throw new Error("name is required");
  if (limitProblem(after.steps)) throw new Error("the time limit is not complete");
  const draftId = await workingDraft(hubId);
  const workflowBody = {
    ...workflowCarried(before.loaded),
    ...(after.opensIn === "chat" ? { opens_in: "chat" } : {}),
    draft_id: draftId,
    name: after.name.trim(),
    description: after.description.trim(),
  };
  const workflowId = before.id
    ? (await callTool(hubId, "agency_update_workflow", { ...workflowBody, workflow_id: before.id }), before.id)
    : idOf(await callTool(hubId, "agency_create_workflow", workflowBody), "the workflow");

  const base = { draft_id: draftId, workflow_id: workflowId };

  const ids = new Map<string, string>();
  for (const step of after.steps) if (step.id) ids.set(step.key, step.id);
  for (const [place, step] of after.steps.entries()) {
    if (step.id) continue;
    const made = await callTool(hubId, "agency_create_work_item", stepBody(step, ids, place + 1, base, true));
    ids.set(step.key, idOf(made, "the step " + step.name));
  }
  for (const [place, step] of after.steps.entries()) {
    const known = before.steps.find((old) => old.id === step.id);
    if (!known && !hasLinks(step)) continue;
    const body = stepBody(step, ids, place + 1, { ...carriedFrom(known?.loaded ?? step.loaded), ...base }, false, after.steps[place + 1]?.key);
    await callTool(hubId, "agency_update_work_item", { ...body, work_item_id: ids.get(step.key) });
  }
  const kept = new Set(after.steps.map((step) => step.id).filter(Boolean));
  for (const old of before.steps) if (!kept.has(old.id)) await callTool(hubId, "agency_delete_work_item", { work_item_id: old.id });

  for (const record of after.records) {
    const known = before.records.find((old) => old.id === record.id);
    const body = {
      ...carriedFrom(known?.loaded ?? record.loaded),
      ...base,
      name: record.name.trim(),
      role_id: record.roleId,
      viewer_role_id: record.viewerRoleId,
      form_name: record.formName || record.name.trim(),
      questions: record.questions.map(questionBody),
    };
    if (record.id) await callTool(hubId, "agency_update_record", { ...body, record_id: record.id });
    else await callTool(hubId, "agency_create_record", body);
  }
  const keptRecords = new Set(after.records.map((record) => record.id).filter(Boolean));
  for (const old of before.records) if (!keptRecords.has(old.id)) await callTool(hubId, "agency_delete_record", { record_id: old.id });
  return workflowId;
}
