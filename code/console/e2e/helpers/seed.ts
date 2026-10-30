import type { Mcp } from "./mcp";

type Q = { prompt: string; answer_type: string; required: true; options_from?: string; fixed?: string };

export type StepSeed = { title: string; kind: string; role: string; form: string; questions: Q[]; recipient?: string; sentStep?: string };

export type Seeded = { draftId: string; scenarioId: string; scenarioName: string; steps: Record<string, string>; roles: Record<string, string> };

export const ask = (prompt: string, answer_type: string): Q => ({ prompt, answer_type, required: true });
export const pick = (prompt: string, from: string): Q => ({ prompt, answer_type: "single_choice", required: true, options_from: from });

export type Plan = {
  goal: string;
  objective: string;
  rationale: string;
  roles: Record<string, string[]>;
  workflow: { name: string; description: string };
  steps: StepSeed[];
  rules: string[];
  rulesOnTheWorkflow: number[];
  scenario: { name: string; summary: string; actors: { name: string; role: string }[]; thens: Record<string, string>; inputs: { step: string; field: string; value: string }[] };
  route?: { step: string; sent: string; question: string; value: string; goTo: string; otherwise: string };
};

const id = (row: Record<string, unknown>): string => String(row.id);

export const freshDraft = async (mcp: Mcp, description: string): Promise<string> => id(await mcp.tool("agency_create_draft", { description }));

export const seed = async (mcp: Mcp, draftId: string, plan: Plan): Promise<Seeded> => {
  const goal = id(await mcp.tool("agency_create_goal", { draft_id: draftId, title: plan.goal }));
  const objective = id(await mcp.tool("agency_create_objective", { draft_id: draftId, goal_id: goal, title: plan.objective }));
  const market = (await mcp.items("agency_list_modules", { draft_id: draftId, code: "market" }))[0];
  if (!market) throw new Error("the draft has no market module");
  await mcp.tool("agency_attach_module", { draft_id: draftId, objective_id: objective, module_id: id(market), rationale: plan.rationale });

  const roles: Record<string, string> = {};
  for (const [name, permissions] of Object.entries(plan.roles)) roles[name] = id(await mcp.tool("agency_create_role", { draft_id: draftId, name, permissions }));

  const workflow = id(await mcp.tool("agency_create_workflow", { draft_id: draftId, name: plan.workflow.name, description: plan.workflow.description }));
  const steps: Record<string, string> = {};
  for (const [index, step] of plan.steps.entries()) {
    steps[step.title] = id(
      await mcp.tool("agency_create_work_item", {
        draft_id: draftId,
        workflow_id: workflow,
        objective_id: objective,
        title: step.title,
        ordinality: index + 1,
        kind: step.kind,
        role_id: step.role ? roles[step.role] : "",
        form_name: step.form,
        questions: step.questions,
        ...(step.recipient ? { recipient_role_id: roles[step.recipient] } : {}),
        ...(step.sentStep ? { sent_step_id: steps[step.sentStep] } : {}),
      }),
    );
  }
  if (plan.route) {
    const r = plan.route;
    await mcp.tool("agency_update_work_item", {
      draft_id: draftId,
      workflow_id: workflow,
      objective_id: objective,
      title: r.step,
      kind: "route",
      ordinality: plan.steps.findIndex((step) => step.title === r.step) + 1,
      work_item_id: steps[r.step],
      sent_step_id: steps[r.sent],
      routes: [{ match: "all", rules: [{ question: r.question, operator: "is", value: r.value }], go_to_step_id: steps[r.goTo] }],
      otherwise_step_id: steps[r.otherwise],
    });
  }

  const rules: string[] = [];
  for (const text of plan.rules) rules.push(id(await mcp.tool("agency_create_rule", { draft_id: draftId, text })));
  for (const index of plan.rulesOnTheWorkflow) await mcp.tool("agency_attach_rule", { rule_id: rules[index], target_type: "workflow", target_id: workflow });

  const s = plan.scenario;
  const scenario = await mcp.tool("agency_create_scenario", {
    draft_id: draftId,
    name: s.name,
    summary: s.summary,
    workflow_id: workflow,
    actors: s.actors.map((a) => ({ name: a.name, kind: "role", role_id: roles[a.role] })),
    thens: Object.entries(s.thens).map(([title, then]) => ({ step_id: steps[title], then })),
    inputs: s.inputs.map((i) => ({ step_id: steps[i.step], field: i.field, value: i.value })),
  });
  return { draftId, scenarioId: id(scenario), scenarioName: s.name, steps, roles };
};

export const archiveDraft = async (mcp: Mcp, draftId: string): Promise<void> => {
  await mcp.tool("agency_archive_draft", { draft_id: draftId });
};
