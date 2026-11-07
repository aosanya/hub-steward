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

const workflow = file.workflows.find((entry: Rec) => entry.code === "W-40") as Rec;
const stepCodes = ["WI-40-1", "WI-40-2", "WI-40-3", "WI-40-4", "WI-40-5"];
const stepsInFile = stepCodes.map((code) => file.work_items.find((item: Rec) => item.code === code && item.workflow_id === workflow.id) as Rec);
const stepsByOrdinality = [...stepsInFile].sort((a, b) => a.ordinality - b.ordinality);
const roleOf = (step: Rec) => file.roles.find((role: Rec) => role.id === step.role_id) as Rec;
const actorOf = (step: Rec) => roleOf(step).name;
const roleCodes = ["R-6", "R-4", "R-8", "R-1", "R-4"];
const aiClause = /MI-szerep/;
const ruleClause = /RU-AI-1/;
const humanApproval = /ember hagyja jóvá/;

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

describe("workflow W-40, the overdue list at every council meeting: the clerk opens each step", () => {
  stepCodes.forEach((code, index) => {
    const number = index + 1;

    it(`${code}. step ${number} shows its title, its role and its AI-drafts clause`, async () => {
      const step = stepsInFile[index];
      expect(step.ordinality).toBe(number);
      expect(roleOf(step).code).toBe(roleCodes[index]);
      await openWorkflow();

      const card = stepCard(number, step.title);
      expect(pairsOf(card)).toMatchObject({ Description: step.description, Actor: actorOf(step) });
      expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent(step.title);

      const design = await loadDesign(hub.id, workflow.id);
      expect(design.workflow.steps.map((entry) => entry.prompt)[index]).toBe(step.prompt);
      expect(design.workflow.steps[index].name).toBe(step.title);

      if (aiClause.test(step.prompt)) {
        expect(step.prompt).toMatch(ruleClause);
        expect(step.prompt).toMatch(humanApproval);
      } else {
        expect(step.prompt).not.toMatch(/mesterséges intelligencia/);
        expect(roleOf(step).description).toMatch(/Ezt a szerepet soha nem tölti be mesterséges intelligencia/);
      }
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
      const card = stepCard(index + 1, step.title);
      expect(pairsOf(card).Actor).toBe(actorOf(step));
      expect(roleOf(step).code).toBe(roleCodes[index]);
    });

    const design = await loadDesign(hub.id, workflow.id);
    expect(design.workflow.steps.map((step) => step.prompt)).toEqual(stepsByOrdinality.map((step) => step.prompt));

    const aiSteps = stepsByOrdinality.filter((step) => aiClause.test(step.prompt));
    expect(aiSteps.map((step) => step.code)).toEqual(["WI-40-1", "WI-40-2", "WI-40-3", "WI-40-5"]);
    aiSteps.forEach((step) => {
      expect(step.prompt).toMatch(ruleClause);
      expect(step.prompt).toMatch(humanApproval);
    });
    expect(stepsByOrdinality.filter((step) => !aiClause.test(step.prompt)).map((step) => step.code)).toEqual(["WI-40-4"]);

    expect(file.role_assignments.filter((entry: Rec) => stepsInFile.some((step) => step.id === entry.work_item_id))).toEqual([]);
    expect(writes()).toEqual([]);
    expect(calls.filter((call) => /publish/.test(call.tool))).toEqual([]);
  });
});
