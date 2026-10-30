import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { answerNudge, askModel, chatTool, formNudge, replyTokens, createGoalsTool, showProfileFormTool, showScenarioFormTool, showWorkflowFormTool, type Turn } from "./modelChat";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const schema = { type: "object", properties: { instance_id: { type: "string" } }, required: ["instance_id"] };

const tool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: schema });

const offered = [tool("agency_get_agency"), tool("agency_list_goals"), tool("agency_list_workflows"), tool("agency_list_roles"), tool("agency_create_workflow"), tool("agency_create_scenario"), tool(chatTool)];

const asks = (name: string, args: unknown) => ({ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: args }] } });

const said = (content: string) => ({ message: { role: "assistant", content } });

const cancelAsk: Turn[] = [{ role: "user", content: "Add a cancel workflow" }];

const conversation = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    return { items: [] };
  });
};

const offeredNames = () => ((callToolMock.mock.calls[0][2] as { tools?: { name: string }[] }).tools ?? []).map((spec) => spec.name);

const writes = () => callToolMock.mock.calls.filter((call) => /_(create|update|delete|propose)_/.test(String(call[1])));

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue(offered);
});

describe("asking the chat to add a workflow or a scenario", () => {
  it("offers the workflow form on the Workflows page and the scenario form on the Test page, never both", async () => {
    conversation([said("ok")]);
    await askModel("h1", "a1", cancelAsk, "workflows");
    expect(offeredNames()).toContain(showWorkflowFormTool);
    expect(offeredNames()).not.toContain(showScenarioFormTool);

    callToolMock.mockClear();
    conversation([said("ok")]);
    await askModel("h1", "a1", cancelAsk, "test");
    expect(offeredNames()).toContain(showScenarioFormTool);
    expect(offeredNames()).not.toContain(showWorkflowFormTool);
  });

  it("lands the filled cancel workflow form as the answer and records nothing", async () => {
    conversation([
      asks(showWorkflowFormTool, { name: "Cancel after the Supplier says yes", description: "A Farmer calls off an order", cancel: true, steps: [{ name: "Tell the Supplier", role: "Farmer", kind: "notify" }] }),
      said("Here is a cancel workflow. Check it, then press Save."),
    ]);

    const reply = await askModel("h1", "a1", cancelAsk, "workflows");

    expect(reply.answer).toEqual({
      kind: "form",
      form: "workflow",
      prompt: "Add a cancel workflow",
      fill: { name: "Cancel after the Supplier says yes", description: "A Farmer calls off an order", cancel: true, steps: [{ name: "Tell the Supplier", role: "Farmer", kind: "notify" }] },
    });
    expect(reply.text).toBe("Here is a cancel workflow. Check it, then press Save.");
    expect(reply.calls.map((call) => call.name)).toEqual([showWorkflowFormTool]);
    expect(writes()).toEqual([]);
  });

  it("lands the filled scenario form as the answer and records nothing", async () => {
    const ask: Turn[] = [{ role: "user", content: "Add a scenario that follows the Group order workflow where a farmer stays silent" }];
    conversation([
      asks("agency_list_workflows", {}),
      asks(showScenarioFormTool, { name: "Group order: a farmer stays silent", workflow: "Group order", summary: "The order waits", actors: [{ name: "Farmer 2", role: "Farmer" }] }),
      said("Here is the scenario. Check it, then press Save."),
    ]);

    const reply = await askModel("h1", "a1", ask, "test");

    expect(reply.answer).toEqual({
      kind: "form",
      form: "scenario",
      prompt: ask[0].content,
      fill: { name: "Group order: a farmer stays silent", summary: "The order waits", workflow: "Group order", actors: [{ name: "Farmer 2", role: "Farmer" }] },
    });
    expect(writes()).toEqual([]);
  });

  it("offers the profile form on the Profile page only", async () => {
    conversation([said("ok")]);
    await askModel("h1", "a1", cancelAsk, "profile");
    expect(offeredNames()).toContain(showProfileFormTool);
    expect(offeredNames()).not.toContain(showWorkflowFormTool);

    callToolMock.mockClear();
    conversation([said("ok")]);
    await askModel("h1", "a1", cancelAsk, "goals");
    expect(offeredNames()).not.toContain(showProfileFormTool);
  });

  it("lands the rewritten Purpose as the answer, leaves the name out, and records nothing", async () => {
    const ask: Turn[] = [{ role: "user", content: "Make the Purpose more general, it should cover all facets of farming including animal husbandry" }];
    conversation([
      asks("agency_get_agency", {}),
      asks(showProfileFormTool, { purpose: "A group of farmers in Siaya, Kenya covering crops, animal husbandry and every other part of farming." }),
      said("The new Purpose is on the page. Check it, then press Save changes."),
    ]);

    const reply = await askModel("h1", "a1", ask, "profile");

    expect(reply.answer).toEqual({
      kind: "form",
      form: "profile",
      prompt: ask[0].content,
      fill: { name: "", purpose: "A group of farmers in Siaya, Kenya covering crops, animal husbandry and every other part of farming." },
    });
    expect(reply.calls.map((call) => call.name)).toEqual(["agency_get_agency", showProfileFormTool]);
    expect(writes()).toEqual([]);
  });

  it("offers the goal creation tool on the Goals page only, and no goal form", async () => {
    conversation([said("ok")]);
    await askModel("h1", "a1", cancelAsk, "goals");
    expect(offeredNames()).toContain(createGoalsTool);
    expect(offeredNames()).not.toContain(showProfileFormTool);

    callToolMock.mockClear();
    conversation([said("ok")]);
    await askModel("h1", "a1", cancelAsk, "roles");
    expect(offeredNames()).not.toContain(createGoalsTool);
  });

  it("creates the goals it wrote and their objectives in the working draft, and marks the page as changed", async () => {
    const ask: Turn[] = [{ role: "user", content: "Generate the goals for this agency" }];
    callToolMock.mockImplementation(async (_hub: string, name: string) => {
      if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
      if (name === "agency_list_drafts") return { items: [{ id: "d1", status: "open" }] };
      if (name === "agency_create_goal") return { id: "g-new" };
      return { items: [] };
    });
    const queue: unknown[] = [
      asks("agency_list_goals", {}),
      asks(createGoalsTool, { goals: [{ title: "Farmers buy together", description: "One order.", objectives: [{ title: "Gather needs", description: "Collect each need." }] }] }),
      said("I created one goal with one objective."),
    ];

    const reply = await askModel("h1", "a1", ask, "goals");

    const made = (name: string) => callToolMock.mock.calls.filter((call) => call[1] === name).map((call) => call[2]);
    expect(made("agency_create_goal")).toEqual([{ draft_id: "d1", title: "Farmers buy together", description: "One order." }]);
    expect(made("agency_create_objective")).toEqual([{ draft_id: "d1", goal_id: "g-new", title: "Gather needs", description: "Collect each need." }]);
    expect(reply.changed).toBe("goals");
    expect(reply.answer).toBeUndefined();
    expect(reply.text).toBe("I created one goal with one objective.");
  });

  it("does not mark the page as changed when no goal could be created", async () => {
    const ask: Turn[] = [{ role: "user", content: "Generate the goals" }];
    callToolMock.mockImplementation(async (_hub: string, name: string) => {
      if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
      if (name === "agency_list_drafts") return { items: [{ id: "d1", status: "open" }] };
      if (name === "agency_create_goal") throw new Error("refused");
      return { items: [] };
    });
    const queue: unknown[] = [asks(createGoalsTool, { goals: [{ title: "G" }] }), said("It could not be done.")];

    const reply = await askModel("h1", "a1", ask, "goals");

    expect(reply.changed).toBeUndefined();
  });

  it("is told once to call the tool when it only promises goals", async () => {
    conversation([asks("agency_list_goals", {}), said("I'll draft some goals for you."), asks(createGoalsTool, { goals: [{ title: "G" }] }), said("Done.")]);

    await askModel("h1", "a1", [{ role: "user", content: "Generate the goals" }], "goals");

    const sent = callToolMock.mock.calls.filter((call) => call[1] === chatTool).map((call) => (call[2] as { messages: { role: string; content: string }[] }).messages);
    expect(sent[2].at(-1)?.content).toBe(formNudge(createGoalsTool));
  });

  it("does not run a form tool on a page that does not offer it", async () => {
    conversation([asks(showScenarioFormTool, { name: "x" }), said("Cannot.")]);

    const reply = await askModel("h1", "a1", cancelAsk, "workflows");

    expect(reply.answer).toBeUndefined();
    expect(reply.calls[0].state).toBe("error");
  });
});

describe("a model that sends an empty message", () => {
  const question: Turn[] = [{ role: "user", content: "Is it necessary to say the hub is planned, not open?" }];

  it("is given the largest reply budget on every call, so hidden thinking cannot use it all up", async () => {
    conversation([{ message: { role: "assistant", content: "" } }, said("Keep it.")]);

    await askModel("h1", "a1", question, "profile");

    const sent = callToolMock.mock.calls.filter((call) => call[1] === chatTool).map((call) => (call[2] as { max_tokens?: number }).max_tokens);
    expect(sent).toEqual([replyTokens, replyTokens]);
  });

  it("is asked once more to answer, and the second message is the answer", async () => {
    conversation([{ message: { role: "assistant", content: "" } }, said("It is a fact about the hub, so keep it unless you want it gone.")]);

    const reply = await askModel("h1", "a1", question, "profile");

    expect(reply.text).toBe("It is a fact about the hub, so keep it unless you want it gone.");
    const second = (callToolMock.mock.calls[1][2] as { messages: { role: string; content: string }[] }).messages;
    expect(second.at(-1)).toEqual({ role: "user", content: answerNudge });
  });

  it("reads an answer that arrives as parts of text", async () => {
    conversation([{ message: { role: "assistant", content: [{ type: "text", text: "Keep it. " }, { type: "text", text: "It is true." }] } }]);

    expect((await askModel("h1", "a1", question, "profile")).text).toBe("Keep it. It is true.");
  });

  it("gives up after the one nudge", async () => {
    conversation([{ message: { role: "assistant", content: "" } }]);

    await expect(askModel("h1", "a1", question, "profile")).rejects.toThrow("the model sent no answer");
    expect(callToolMock).toHaveBeenCalledTimes(2);
  });

  it("puts what the model actually sent into the error so it can be seen", async () => {
    conversation([{ message: { role: "assistant", content: "", function_call: { name: "show_profile_form" } }, finish_reason: "tool_calls" }]);

    await expect(askModel("h1", "a1", question, "profile")).rejects.toThrow(/the model sent no answer: .*function_call.*show_profile_form/);
  });
});

describe("a model that reads, then only promises the change", () => {
  const broaden: Turn[] = [{ role: "user", content: "make the purpose broader, include veterinary services and transporters" }];

  it("is told to call the form tool, and the form it then fills lands as the answer", async () => {
    conversation([
      asks("agency_get_agency", {}),
      said("I'll broaden that Purpose to cover all agricultural stakeholders for your review."),
      asks(showProfileFormTool, { purpose: "Everyone in agriculture: farmers, veterinarians, transporters and financiers." }),
      said("It is filled in, check it and press Save."),
    ]);

    const reply = await askModel("h1", "a1", broaden, "profile");

    expect(reply.answer).toEqual({
      kind: "form",
      form: "profile",
      prompt: broaden[0].content,
      fill: { name: "", purpose: "Everyone in agriculture: farmers, veterinarians, transporters and financiers." },
    });
    const sent = callToolMock.mock.calls.filter((call) => call[1] === chatTool).map((call) => (call[2] as { messages: { role: string; content: string }[] }).messages);
    expect(sent[2].at(-1)).toEqual({ role: "user", content: formNudge(showProfileFormTool) });
    expect(writes()).toEqual([]);
  });

  it("is asked only once, and a plain answer after that stands", async () => {
    conversation([asks("agency_get_agency", {}), said("The Purpose is about farmers."), said("The Purpose is about farmers.")]);

    const reply = await askModel("h1", "a1", [{ role: "user", content: "what is the purpose?" }], "profile");

    expect(reply.text).toBe("The Purpose is about farmers.");
    expect(reply.answer).toBeUndefined();
    expect(callToolMock.mock.calls.filter((call) => call[1] === chatTool)).toHaveLength(3);
  });

  it("does not ask on a page with no form tool", async () => {
    conversation([asks("agency_get_agency", {}), said("Done.")]);

    await askModel("h1", "a1", broaden, "roles");

    expect(callToolMock.mock.calls.filter((call) => call[1] === chatTool)).toHaveLength(2);
  });
});
