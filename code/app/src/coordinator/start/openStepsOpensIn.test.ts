import { afterEach, describe, expect, it, vi } from "vitest";
import { chatStepOf } from "../../journeys/chatSteps";
import * as mcp from "../../wakala/mcp";
import { mcpStartClient } from "./api";

const formStep = {
  id: "f1",
  title: "Say how much",
  kind: "fill_form",
  workflow_name: "Group order",
  opens_in: "form",
  role_name: "Farmer",
  form_name: "Urea group order",
  questions: [{ prompt: "Product", answer_type: "free_text" }],
};

const reading = (items: object[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_agency: string, tool: string) => {
    if (tool === "agency_list_my_open_steps") return { items };
    if (tool === "agency_get_agency") return { name: "Siaya Farmers' Group" };
    throw new Error(`no answer for ${tool}`);
  }) as never);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the open steps read, by the type the agency gives each workflow", () => {
  it("returns a chat workflow's chat step with its workflow's name and opensIn chat", async () => {
    reading([chatStepOf("Plant advice")]);
    const steps = await mcpStartClient.openSteps();
    expect(steps.map((step) => [step.workflowName, step.opensIn])).toEqual([["Plant advice", "chat"]]);
  });

  it("returns a form workflow's step with opensIn form", async () => {
    reading([formStep]);
    const steps = await mcpStartClient.openSteps();
    expect(steps.map((step) => [step.formName, step.opensIn])).toEqual([["Urea group order", "form"]]);
  });

  it("reads a step that names no type as a form", async () => {
    const { opens_in: _gone, ...untyped } = formStep;
    reading([untyped, { ...formStep, id: "f2", opens_in: "something else" }]);
    const steps = await mcpStartClient.openSteps();
    expect(steps.map((step) => step.opensIn)).toEqual(["form", "form"]);
  });

  it("keeps the order the agency gave, chat and form steps together", async () => {
    reading([chatStepOf("Plant advice"), formStep, chatStepOf("Weather advice")]);
    const steps = await mcpStartClient.openSteps();
    expect(steps.map((step) => step.opensIn)).toEqual(["chat", "form", "chat"]);
  });

  it("drops a step of a chat workflow that is not its chat step and has no form to fill", async () => {
    reading([{ ...chatStepOf("Plant advice"), id: "n1", kind: "notify" }]);
    expect(await mcpStartClient.openSteps()).toEqual([]);
  });

  it("leaves a chat step out of the waiting group-order starts", async () => {
    reading([chatStepOf("Plant advice"), formStep]);
    expect(await mcpStartClient.waiting()).toEqual([]);
  });
});
