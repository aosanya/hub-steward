import { cleanup, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadDesign } from "../data/pages/workflowDesign";
import type { Hub } from "../types";
import { callTool } from "../wakala/mcp";
import { cardNamed, cardShown, goTo, heading, main, mountConsole, pairsOf, user } from "./walkSupport";

vi.hoisted(() => {
  process.env.RTL_SKIP_AUTO_CLEANUP = "true";
});

vi.setConfig({ testTimeout: 30000 });

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

type Rec = Record<string, any>;

const file = JSON.parse(readFileSync(resolve(__dirname, "../../../../demo/municipality.json"), "utf8")) as Record<string, Rec[] & Rec>;

const workflow = file.workflows.find((entry: Rec) => entry.code === "W-1") as Rec;
const stepCodes = ["WI-1", "WI-2", "WI-3", "WI-4", "WI-5"];
const stepsInFile = stepCodes.map((code) => file.work_items.find((item: Rec) => item.code === code && item.workflow_id === workflow.id) as Rec);
const stepsByOrdinality = [...stepsInFile].sort((a, b) => a.ordinality - b.ordinality);
const roleOf = (step: Rec) => file.roles.find((role: Rec) => role.id === step.role_id);
const actorOf = (step: Rec) => roleOf(step)?.name ?? "The agency";
const aiClause = /MI-szerep/;
const humanApproval = /ember hagyja jóvá/;
const roleCodes: Record<string, string> = { "WI-1": "R-6", "WI-2": "R-7", "WI-3": "R-6", "WI-4": "R-7", "WI-5": "R-7" };
const aiRule = file.rules.find((rule: Rec) => rule.code === "RU-AI-1") as Rec;

const hub: Hub = { id: "zoldhalom", name: (file.agency as Rec).name, role: "owner", kind: "municipality", model_key_set: true };

const calls: { tool: string; args: Rec }[] = [];

const handlers: Record<string, (args: Rec) => unknown> = {
  ai_list_accounts: () => ({ items: [] }),
  agency_list_drafts: () => ({ items: [{ id: "d1", status: "open" }] }),
  agency_list_approvals: () => ({ items: [] }),
  agency_list_pickers: () => ({ actors: file.roles.map((role: Rec) => ({ id: role.id, name: role.name, kind: "role" })), answer_types: ["free_text"] }),
  agency_list_objectives: () => ({ items: file.objectives }),
  agency_list_workflow_objectives: (args) => ({ items: file.workflow_objectives.filter((link: Rec) => !args.workflow_id || link.workflow_id === args.workflow_id) }),
  agency_list_workflows: () => ({ items: [workflow] }),
  agency_get_workflow: (args) => (args.workflow_id === workflow.id ? workflow : null),
  agency_list_work_items: () => ({ items: [...stepsInFile].reverse() }),
  agency_list_role_assignments_for_work_item: (args) => ({ items: file.role_assignments.filter((entry: Rec) => entry.work_item_id === args.work_item_id) }),
  agency_list_roles: () => ({ items: file.roles }),
  agency_list_default_workflows: () => ({ items: [] }),
  agency_list_records: () => ({ items: [] }),
  agency_list_scenarios: () => ({ items: [] }),
  taskmanager_workflow_run_list_under_way: () => ({ items: [] }),
  taskmanager_workflow_run_list_closed: () => ({ items: [] }),
};

const fakeAgency = async (_hub: string, tool: string, args: Rec = {}) => {
  calls.push({ tool, args });
  return handlers[tool]?.(args) ?? { items: [] };
};

const writes = () => calls.filter((call) => /^agency_(create|update|delete|propose|publish)/.test(call.tool));

const stepCard = (number: number, title: string) => screen.getByRole("heading", { level: 2, name: `${number} · ${title}` }).closest("section") as HTMLElement;

const openWorkflow = async () => {
  await goTo("Workflows");
  await cardShown(workflow.name);
  await user.click(within(cardNamed(workflow.name)).getByRole("link", { name: workflow.name }));
  await heading(workflow.name);
  await screen.findByRole("heading", { level: 2, name: `1 · ${stepsByOrdinality[0].title}` });
};

beforeAll(() => {
  window.localStorage.clear();
  vi.mocked(callTool).mockImplementation(fakeAgency as unknown as typeof callTool);
  mountConsole(hub);
});

afterAll(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.RTL_SKIP_AUTO_CLEANUP;
});

describe("workflow W-1, register upkeep: the officer opens each step", () => {
  stepCodes.forEach((code, index) => {
    const number = index + 1;

    it(`${code}. step ${number} shows its title, its role and its prompt`, async () => {
      const step = stepsInFile[index];
      expect(step.ordinality).toBe(number);
      await openWorkflow();

      const card = stepCard(number, step.title);
      expect(pairsOf(card)).toMatchObject({ Description: step.description, Actor: actorOf(step) });
      expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent(step.title);

      const design = await loadDesign(hub.id, workflow.id);
      expect(design.workflow.steps.map((entry) => entry.prompt)[index]).toBe(step.prompt);
      expect(design.workflow.steps[index].name).toBe(step.title);
      expect(writes()).toEqual([]);
    });
  });

  it("the five steps in order: by ordinality, with the role of each, and nothing reaches the public without a person approving", async () => {
    await openWorkflow();

    const shown = main()
      .getAllByRole("heading", { level: 2 })
      .map((entry) => entry.textContent ?? "")
      .filter((text) => /^\d+ · /.test(text));
    expect(shown).toEqual(stepsByOrdinality.map((step, index) => `${index + 1} · ${step.title}`));
    expect(stepsByOrdinality.map((step) => step.code)).toEqual(stepCodes);

    stepsByOrdinality.forEach((step, index) => {
      expect(pairsOf(stepCard(index + 1, step.title)).Actor).toBe(actorOf(step));
    });
    stepsByOrdinality.forEach((step) => expect(roleOf(step)?.code).toBe(roleCodes[step.code]));
    expect(file.role_assignments.filter((entry: Rec) => stepsInFile.some((step) => step.id === entry.work_item_id))).toEqual([]);

    const design = await loadDesign(hub.id, workflow.id);
    expect(design.workflow.steps.map((step) => step.prompt)).toEqual(stepsByOrdinality.map((step) => step.prompt));

    const aiSteps = stepsByOrdinality.filter((step) => aiClause.test(step.prompt));
    expect(aiSteps.map((step) => step.code)).toEqual(["WI-1", "WI-2", "WI-3"]);
    aiSteps.forEach((step) => expect(step.prompt).toMatch(humanApproval));
    stepsByOrdinality.filter((step) => !aiClause.test(step.prompt)).forEach((step) => expect(step.prompt).not.toMatch(/mesterséges intelligencia/));

    const publisher = file.roles.find((role: Rec) => role.code === "R-4") as Rec;
    expect(publisher.description).toMatch(/Betöltheti mesterséges intelligencia/);
    expect(publisher.description).toMatch(/minden kimenő anyagot .* jóvá/);

    expect(aiRule.text).toMatch(/csak fogalmaz, összegez, utánajár vagy számol/);
    expect(aiRule.text).toMatch(/ember hagyja jóvá/);
    const attached = file.rule_attachments.filter((entry: Rec) => entry.rule_code === "RU-AI-1");
    const workflowObjectives = file.workflow_objectives.filter((link: Rec) => link.workflow_id === workflow.id).map((link: Rec) => file.objectives.find((objective: Rec) => objective.id === link.objective_id).code);
    expect(attached.map((entry: Rec) => entry.target_code).sort()).toEqual([...workflowObjectives].sort());

    expect(writes()).toEqual([]);
    expect(calls.filter((call) => /publish/.test(call.tool))).toEqual([]);
  });
});
