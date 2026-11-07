import { cleanup, screen, within } from "@testing-library/react";
import { loadDesign } from "../data/pages/workflowDesign";
import type { Hub } from "../types";
import { callTool } from "../wakala/mcp";
import { agencyWith, pattern, walkFixtures, type Rec, type WalkFixture } from "./walkFixture";
import { cardNamed, cardShown, goTo, heading, main, mountConsole, pairsOf, user } from "./walkSupport";

vi.hoisted(() => {
  process.env.RTL_SKIP_AUTO_CLEANUP = "true";
});

vi.setConfig({ testTimeout: 30000 });

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const walk = (fixture: WalkFixture) => {
  const file = agencyWith(fixture.sources);
  const checks = fixture.checks ?? {};
  const workflow = file.workflows.find((entry) => entry.code === fixture.workflow) as Rec;
  const stepCodes = fixture.steps.map((step) => step.code);
  const stepsInFile = stepCodes.map((code) => file.work_items.find((item) => item.code === code && item.workflow_id === workflow.id) as Rec);
  const stepsByOrdinality = [...stepsInFile].sort((a, b) => a.ordinality - b.ordinality);
  const roleOf = (step: Rec) => file.roles.find((role) => role.id === step.role_id);
  const actorOf = (step: Rec) => roleOf(step)?.name ?? "The agency";
  const specOf = (code: string) => fixture.steps.find((step) => step.code === code)!;
  const aiClause = pattern(fixture.aiClause);
  const humanApproval = pattern(fixture.humanApproval);
  const ruleRef = fixture.ruleRef ? pattern(fixture.ruleRef) : null;
  const aiCodes = fixture.steps.filter((step) => step.ai).map((step) => step.code);
  const roleCode = (code: string) => file.roles.find((role) => role.code === code) as Rec;
  const hub: Hub = { id: "zoldhalom", name: file.agency.name, role: "owner", kind: "municipality", model_key_set: true };
  const calls: { tool: string; args: Rec }[] = [];

  const handlers: Record<string, (args: Rec) => unknown> = {
    ai_list_accounts: () => ({ items: [] }),
    agency_list_drafts: () => ({ items: [{ id: "d1", status: "open" }] }),
    agency_list_approvals: () => ({ items: [] }),
    agency_list_pickers: () => ({ actors: file.roles.map((role) => ({ id: role.id, name: role.name, kind: "role" })), answer_types: ["free_text"] }),
    agency_list_objectives: () => ({ items: file.objectives }),
    agency_list_workflow_objectives: (args) => ({ items: file.workflow_objectives.filter((link) => !args.workflow_id || link.workflow_id === args.workflow_id) }),
    agency_list_workflows: () => ({ items: [workflow] }),
    agency_get_workflow: (args) => (args.workflow_id === workflow.id ? workflow : null),
    agency_list_work_items: () => ({ items: [...stepsInFile].reverse() }),
    agency_list_role_assignments_for_work_item: (args) => ({ items: (file.role_assignments ?? []).filter((entry) => entry.work_item_id === args.work_item_id) }),
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

  const textOf = (step: Rec) => step.prompt as string;

  describe(`workflow ${fixture.workflow}, ${fixture.title}`, () => {
    beforeAll(() => {
      window.localStorage.clear();
      vi.mocked(callTool).mockImplementation(fakeAgency as unknown as typeof callTool);
      mountConsole(hub);
    });

    afterAll(() => {
      cleanup();
      vi.unstubAllGlobals();
    });

    stepCodes.forEach((code, index) => {
      const number = index + 1;
      const spec = specOf(code);

      it(`${code}. step ${number} shows its title, its role, its prompt and its AI-drafts clause`, async () => {
        const step = stepsInFile[index];
        expect(step.ordinality).toBe(number);
        expect(roleOf(step)?.code).toBe(spec.role ?? undefined);
        await openWorkflow();

        const card = stepCard(number, step.title);
        expect(pairsOf(card)).toMatchObject({ Description: step.description, Actor: actorOf(step) });
        expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent(step.title);

        const design = await loadDesign(hub.id, workflow.id);
        expect(design.workflow.steps.map((entry) => entry.prompt)[index]).toBe(step.prompt);
        expect(design.workflow.steps[index].name).toBe(step.title);

        if (spec.ai) {
          expect(textOf(step)).toMatch(aiClause);
          expect(textOf(step)).toMatch(humanApproval);
          if (ruleRef) expect(textOf(step)).toMatch(ruleRef);
          if (checks.aiPromptText) expect(textOf(step)).toMatch(pattern(checks.aiPromptText));
          (checks.aiRoleText ?? []).forEach((text) => expect(roleOf(step)?.description).toMatch(pattern(text)));
        } else {
          expect(textOf(step)).not.toMatch(aiClause);
          if (!fixture.nonAiPromptMentionsAi) expect(textOf(step)).not.toMatch(/mesterséges intelligencia/);
          (checks.nonAiRoleText ?? []).forEach((text) => expect(roleOf(step)?.description).toMatch(pattern(text)));
        }
        if (ruleRef && fixture.ruleRefOnEveryStep) expect(textOf(step)).toMatch(ruleRef);
        expect(writes()).toEqual([]);
      });
    });

    it(`all ${stepCodes.length} steps in order: by ordinality, with the role of each, an AI role only drafts, summarises, chases or counts, and a person approves before anything reaches the public`, async () => {
      await openWorkflow();

      const shown = main()
        .getAllByRole("heading", { level: 2 })
        .map((entry) => entry.textContent ?? "")
        .filter((text) => /^\d+ · /.test(text));
      expect(shown).toEqual(stepsByOrdinality.map((step, index) => `${index + 1} · ${step.title}`));
      expect(stepsByOrdinality.map((step) => step.code)).toEqual(stepCodes);
      expect(stepsByOrdinality.map((step) => roleOf(step)?.code)).toEqual(fixture.steps.map((step) => step.role ?? undefined));

      stepsByOrdinality.forEach((step, index) => {
        expect(pairsOf(stepCard(index + 1, step.title)).Actor).toBe(actorOf(step));
      });
      expect((file.role_assignments ?? []).filter((entry) => stepsInFile.some((step) => step.id === entry.work_item_id))).toEqual([]);
      if (checks.firstActor) expect(actorOf(stepsByOrdinality[0])).toBe(checks.firstActor);

      const design = await loadDesign(hub.id, workflow.id);
      expect(design.workflow.steps.map((step) => step.prompt)).toEqual(stepsByOrdinality.map((step) => step.prompt));

      const aiSteps = stepsByOrdinality.filter((step) => aiClause.test(textOf(step)));
      expect(aiSteps.map((step) => step.code)).toEqual(aiCodes);
      aiSteps.forEach((step) => {
        expect(textOf(step)).toMatch(humanApproval);
        if (ruleRef) expect(textOf(step)).toMatch(ruleRef);
        if (checks.aiPromptText) expect(textOf(step)).toMatch(pattern(checks.aiPromptText));
      });
      const humanSteps = stepsByOrdinality.filter((step) => !aiClause.test(textOf(step)));
      if (!fixture.nonAiPromptMentionsAi) humanSteps.forEach((step) => expect(textOf(step)).not.toMatch(/mesterséges intelligencia/));

      const aiRule = file.rules.find((rule) => rule.code === "RU-AI-1") as Rec;
      expect(aiRule.text).toMatch(/csak fogalmaz, összegez, utánajár vagy számol/);
      expect(aiRule.text).toMatch(/ember hagyja jóvá/);

      (checks.roleText ?? []).forEach((entry) => entry.match.forEach((text) => expect(roleCode(entry.role).description).toMatch(pattern(text))));
      (checks.stepText ?? []).forEach((entry) => {
        const step = stepsInFile[stepCodes.indexOf(entry.step)];
        (entry.match ?? []).forEach((text) => expect(textOf(step)).toMatch(pattern(text)));
        (entry.absent ?? []).forEach((text) => expect(textOf(step)).not.toMatch(pattern(text)));
      });
      (checks.order ?? []).forEach(([before, after]) => {
        expect(stepsByOrdinality.findIndex((step) => step.code === before)).toBeLessThan(stepsByOrdinality.findIndex((step) => step.code === after));
      });
      if (checks.workflowText) expect(workflow.description).toMatch(pattern(checks.workflowText));
      if (checks.itemCount !== undefined) expect(file.work_items.filter((item) => item.workflow_id === workflow.id)).toHaveLength(checks.itemCount);

      const links = file.workflow_objectives.filter((link) => link.workflow_id === workflow.id);
      expect(file.workflow_objectives.every((link) => file.objectives.some((objective) => objective.id === link.objective_id))).toBe(true);
      const linked = links.map((link) => file.objectives.find((entry) => entry.id === link.objective_id)?.code);
      if (checks.objectives) expect(linked).toEqual(checks.objectives);
      (checks.ruleAttached ?? []).forEach((entry) => {
        expect(file.rule_attachments.some((attached) => attached.rule_code === entry.rule && attached.target_code === entry.target)).toBe(true);
      });
      if (checks.ruleAttachedToAllObjectives) {
        const attached = file.rule_attachments.filter((entry) => entry.rule_code === "RU-AI-1").map((entry) => entry.target_code);
        expect(attached).toEqual(expect.arrayContaining(linked));
      }

      expect(writes()).toEqual([]);
      expect(calls.filter((call) => /publish/.test(call.tool))).toEqual([]);
    });
  });
};

walkFixtures().forEach(({ fixture }) => walk(fixture));
