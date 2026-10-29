import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { actionOf, emptyQuestion, emptyRecord, emptyStep, emptyWorkflow, loadDesign, saveDesign, type StepDraft } from "./workflowDesign";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const call = vi.mocked(callTool);

type Args = Record<string, unknown>;

const answers = (replies: Record<string, unknown>) => {
  let made = 0;
  call.mockImplementation((async (_hub: string, tool: string, args: Args = {}) => {
    const reply = replies[tool];
    if (typeof reply === "function") return reply(args);
    if (reply !== undefined) return reply;
    if (/^agency_create_/.test(tool)) return { id: "made-" + ++made };
    return { items: [] };
  }) as typeof callTool);
};

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool).map(([, , args]) => args as Args);

const hub = {
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_pickers: {
    actors: [
      { id: "a1", name: "The agency", kind: "agency" },
      { id: "r1", name: "Group coordinator", kind: "role" },
      { id: "r2", name: "Farmer", kind: "role" },
      { id: "g1", name: "Siaya farmers", kind: "group" },
    ],
    answer_types: ["yes_no", "single_choice", "multi_select", "free_text", "date", "time", "number", "currency", "photo", "file"],
  },
  agency_list_workflows: { items: [{ id: "w1", name: "Group order" }, { id: "w2", name: "Cancel" }] },
};

const stepAt = (name: string, more: Partial<StepDraft> = {}): StepDraft => ({ ...emptyStep(), name, ...more });

beforeEach(() => {
  call.mockReset();
  answers(hub);
});

describe("loading a workflow to design", () => {
  it("offers the roles, the workflows, and the groups beside the roles as lists", async () => {
    const { choices, workflow } = await loadDesign("h", null);

    expect(choices.roles).toEqual([
      { value: "r1", label: "Group coordinator" },
      { value: "r2", label: "Farmer" },
    ]);
    expect(choices.workflows.map((choice) => choice.label)).toEqual(["Group order", "Cancel"]);
    expect(choices.lists.map((choice) => choice.value)).toEqual(["Group coordinator", "Farmer", "Siaya farmers"]);
    expect(callsTo("agency_list_objectives")).toEqual([]);
    expect(workflow).toEqual(emptyWorkflow());
  });

  it("reads every picker from the one agency_list_pickers answer, the forms module's ten answer types included", async () => {
    const { choices } = await loadDesign("h", null);

    expect(callsTo("agency_list_pickers")).toEqual([{ draft_id: "d1" }]);
    expect(callsTo("agency_list_roles")).toEqual([]);
    expect(callsTo("actor_list_groups")).toEqual([]);
    expect(choices.answerTypes).toEqual(["yes_no", "single_choice", "multi_select", "free_text", "date", "time", "number", "currency", "photo", "file"]);
  });

  it("keeps a question of a type the page has not seen before", async () => {
    answers({
      ...hub,
      agency_get_workflow: { id: "w1", name: "A" },
      agency_list_work_items: { items: [{ id: "s1", workflow_id: "w1", kind: "fill_form", questions: [{ prompt: "Which?", answer_type: "multi_select", options: ["a", "b"] }] }] },
    });

    const { workflow } = await loadDesign("h", "w1");

    expect(workflow.steps[0].questions[0]).toMatchObject({ answerType: "multi_select", options: ["a", "b"] });
  });

  it("reads the steps of one workflow in their place, with kind, actor, form, links and routes, and its records", async () => {
    answers({
      ...hub,
      agency_get_workflow: { id: "w1", name: "Group order", description: "Farmers buy together" },
      agency_list_work_items: {
        items: [
          { id: "s2", workflow_id: "w1", ordinality: 2, title: "Sort", kind: "route", sent_step_id: "s1", otherwise_step_id: "s3", routes: [{ match: "any", go_to_step_id: "s3", rules: [{ question: "Join?", operator: "is_not", value: "Yes" }] }] },
          { id: "s1", workflow_id: "w1", ordinality: 1, title: "Send", kind: "send_form", form_name: "Invitation", questions: [{ prompt: "Join?", answer_type: "yes_no", required: true, helper: "All members" }] },
          { id: "s3", workflow_id: "w1", ordinality: 3, title: "Open", kind: "fill_form", role_id: "r2" },
          { id: "x1", workflow_id: "w2", ordinality: 1, title: "Other" },
        ],
      },
      agency_list_records: { items: [{ id: "c1", workflow_id: "w1", name: "Payments", role_id: "r1", viewer_role_id: "r2", form_name: "Payments", questions: [{ prompt: "Amount", answer_type: "currency", required: true }] }, { id: "c2", workflow_id: "w2", name: "Elsewhere" }] },
    });

    const { workflow } = await loadDesign("h", "w1");

    expect(workflow.description).toBe("Farmers buy together");
    expect(workflow.steps.map((step) => step.name)).toEqual(["Send", "Sort", "Open"]);
    expect(workflow.steps[0].questions[0]).toMatchObject({ prompt: "Join?", answerType: "yes_no", helper: "All members", required: true });
    expect(workflow.steps[1]).toMatchObject({ kind: "route", sentKey: "s1", otherwiseKey: "s3" });
    expect(workflow.steps[1].routes).toEqual([{ match: "any", goTo: "s3", rules: [{ question: "Join?", operator: "is_not", value: "Yes" }] }]);
    expect(workflow.steps[2].roleId).toBe("r2");
    expect(workflow.records.map((record) => record.name)).toEqual(["Payments"]);
    expect(workflow.records[0]).toMatchObject({ roleId: "r1", viewerRoleId: "r2" });
  });

  it("sends the role that sees a record's rows when the record is updated, and an empty one when it is cleared", async () => {
    answers({ ...hub, agency_list_drafts: { items: [{ id: "d1", status: "open" }] } });
    const seen = { ...emptyRecord(), key: "c1", id: "c1", name: "Payments", roleId: "r1", viewerRoleId: "r2" };
    const before = { ...emptyWorkflow(), id: "w1", name: "Group order", records: [seen] };

    await saveDesign("h", before, { ...before, records: [seen] });
    await saveDesign("h", before, { ...before, records: [{ ...seen, viewerRoleId: "" }] });

    expect(callsTo("agency_update_record")).toEqual([
      expect.objectContaining({ record_id: "c1", role_id: "r1", viewer_role_id: "r2" }),
      expect.objectContaining({ record_id: "c1", role_id: "r1", viewer_role_id: "" }),
    ]);
  });

  it("asks the working draft for the roles, workflows, work items and records", async () => {
    answers({ ...hub, agency_get_workflow: { id: "w1", name: "A" } });

    await loadDesign("h", "w1");

    expect(callsTo("agency_list_work_items")).toEqual([{ draft_id: "d1" }]);
    expect(callsTo("agency_list_records")).toEqual([{ draft_id: "d1" }]);
  });

  it("fails when the pickers cannot be read", async () => {
    answers({ ...hub, agency_list_pickers: () => Promise.reject(new Error("down")) });

    await expect(loadDesign("h", null)).rejects.toThrow("down");
  });
});

describe("the action a step shows", () => {
  const none = { choices: [] };

  it("is derived from the kind and the form, as the backend derives it", () => {
    const send = stepAt("Send the invitation", { key: "s", kind: "send_form", formName: "Invitation form" });
    const answer = stepAt("Answer", { kind: "yes_no", sentKey: "s" });
    expect(actionOf(stepAt("Start", { formName: "Group order form" }), [], none.choices)).toBe("Fills the Group order form");
    expect(actionOf(send, [send], none.choices)).toBe("Sends the invitation form");
    expect(actionOf(answer, [send, answer], none.choices)).toBe("Answers the invitation form");
    expect(actionOf(stepAt("Sort", { kind: "route" }), [], none.choices)).toBe("Routes the answers");
    expect(actionOf(stepAt("Cancel", { kind: "run_workflow", runWorkflowId: "w2" }), [], [{ value: "w2", label: "Cancel" }])).toBe("Starts Cancel");
    expect(actionOf(stepAt("Chat with an agent", { kind: "chat" }), [], none.choices)).toBe("Chats with an agent");
  });
});

describe("a workflow that opens in a chat", () => {
  const chatStep = {
    id: "s1",
    code: "S-1",
    workflow_id: "w1",
    draft_id: "d1",
    title: "Chat with an agent",
    description: "",
    ordinality: 1,
    prompt: "",
    kind: "chat",
    role_id: "r2",
    agent_role_id: "r1",
    topic: "Buying farm inputs",
    opening_line: "What do you need?",
    prompts: ["See what is on sale"],
    tools: ["market_list_offers"],
    start_workflow_ids: ["w2"],
  };

  const loaded = async () => {
    answers({
      ...hub,
      agency_get_workflow: { id: "w1", name: "Buy inputs", opens_in: "chat" },
      agency_list_work_items: { items: [chatStep, { id: "s2", workflow_id: "w1", ordinality: 2, title: "Thank", kind: "notify", form_name: "Thanks" }] },
    });
    return (await loadDesign("h", "w1")).workflow;
  };

  it("reads what it opens in and how many orders are under way", async () => {
    answers({
      ...hub,
      agency_get_workflow: { id: "w1", name: "Buy inputs", opens_in: "chat", orders_under_way: 2 },
      agency_list_work_items: { items: [] },
    });

    const { workflow } = await loadDesign("h", "w1");

    expect(workflow).toMatchObject({ opensIn: "chat", ordersUnderWay: 2 });
    expect(emptyWorkflow()).toMatchObject({ opensIn: "form", ordersUnderWay: 0 });
  });

  it("reads its chat step as a chat step", async () => {
    const workflow = await loaded();

    expect(workflow.steps.map((step) => step.kind)).toEqual(["chat", "notify"]);
    expect(workflow.steps[0].roleId).toBe("r2");
  });

  it("saves the chat step as a chat step, with the role that opens it and the chat it holds, when only its name changed", async () => {
    const before = await loaded();

    await saveDesign("h", before, { ...before, steps: before.steps.map((step, at) => (at === 0 ? { ...step, name: "Chat with the farmers' agent" } : step)) });

    const [chat] = callsTo("agency_update_work_item");
    expect(chat).toMatchObject({
      work_item_id: "s1",
      title: "Chat with the farmers' agent",
      kind: "chat",
      role_id: "r2",
      agent_role_id: "r1",
      topic: "Buying farm inputs",
      opening_line: "What do you need?",
      prompts: ["See what is on sale"],
      tools: ["market_list_offers"],
      start_workflow_ids: ["w2"],
      form_name: "",
      questions: [],
    });
  });
});

describe("saving a workflow", () => {
  it("creates the workflow, then its steps in order, then the records, in the working draft", async () => {
    const send = stepAt("Send", { key: "send", kind: "send_form", questions: [{ ...emptyQuestion(), prompt: "Join?" }] });
    const sort = stepAt("Sort", { kind: "route", sentKey: "send", routes: [{ match: "all", goTo: "", rules: [{ question: "Join?", operator: "is", value: "Yes" }] }] });
    const open = stepAt("Open", { roleId: "r2", questions: [{ ...emptyQuestion(), prompt: "Bags?", answerType: "number" }] });
    const record = { ...emptyRecord(), name: "Payments", roleId: "r1", questions: [{ ...emptyQuestion(), prompt: "Amount" }] };

    await saveDesign("h", emptyWorkflow(), { ...emptyWorkflow(), name: " Group order ", description: "Together", steps: [send, sort, open], records: [record] });

    expect(callsTo("agency_create_workflow")).toEqual([{ draft_id: "d1", name: "Group order", description: "Together" }]);
    const created = callsTo("agency_create_work_item");
    expect(created.map((args) => args.title)).toEqual(["Send", "Sort", "Open"]);
    expect(created.map((args) => args.ordinality)).toEqual([1, 2, 3]);
    expect(created[0]).toMatchObject({ workflow_id: "made-1", draft_id: "d1", kind: "send_form", role_id: "", form_name: "Send form" });
    expect(created[1]).toMatchObject({ kind: "route", sent_step_id: "", routes: [], form_name: "", questions: [] });
    expect(created[2]).toMatchObject({ kind: "fill_form", role_id: "r2", questions: [expect.objectContaining({ prompt: "Bags?", answer_type: "number" })] });
    const links = callsTo("agency_update_work_item");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ work_item_id: "made-3", sent_step_id: "made-2", otherwise_step_id: "" });
    expect(links[0].routes).toEqual([{ match: "all", rules: [{ question: "Join?", operator: "is", value: "Yes" }], go_to_step_id: "made-4" }]);
    expect(callsTo("agency_create_record")).toEqual([
      expect.objectContaining({ workflow_id: "made-1", name: "Payments", role_id: "r1", viewer_role_id: "", form_name: "Payments", draft_id: "d1" }),
    ]);
  });

  it("starts a draft when none is open", async () => {
    answers({ ...hub, agency_list_drafts: { items: [] }, agency_create_draft: { id: "d9" } });

    await saveDesign("h", emptyWorkflow(), { ...emptyWorkflow(), name: "Cancel" });

    expect(callsTo("agency_create_workflow")[0]).toMatchObject({ draft_id: "d9" });
  });

  it("updates what was there, adds what is new, and deletes what was taken out", async () => {
    const kept = stepAt("Start", { key: "s1", id: "s1", formName: "Group order form" });
    const gone = stepAt("Old", { key: "s2", id: "s2" });
    const oldRecord = { ...emptyRecord(), key: "c1", id: "c1", name: "Payments", roleId: "r1" };
    const before = { ...emptyWorkflow(), id: "w1", name: "Group order", steps: [kept, gone], records: [oldRecord] };
    const added = stepAt("Thank you", { kind: "notify", questions: [{ ...emptyQuestion(), prompt: "Message", fixed: "Thank you for the response" }] });

    await saveDesign("h", before, { ...before, name: "Group orders", steps: [{ ...kept, name: "Begin" }, added], records: [] });

    expect(callsTo("agency_create_workflow")).toEqual([]);
    expect(callsTo("agency_update_workflow")).toEqual([{ draft_id: "d1", name: "Group orders", description: "", workflow_id: "w1" }]);
    expect(callsTo("agency_create_work_item")).toHaveLength(1);
    expect(callsTo("agency_create_work_item")[0]).toMatchObject({ ordinality: 2, kind: "notify" });
    expect(callsTo("agency_create_work_item")[0]).not.toHaveProperty("objective_id");
    expect(callsTo("agency_update_work_item")).toEqual([expect.objectContaining({ work_item_id: "s1", title: "Begin", ordinality: 1, form_name: "Group order form" })]);
    expect(callsTo("agency_update_work_item")[0]).not.toHaveProperty("objective_id");
    expect(callsTo("agency_delete_work_item")).toEqual([{ work_item_id: "s2" }]);
    expect(callsTo("agency_delete_record")).toEqual([{ record_id: "c1" }]);
  });

  describe("when the workflow was loaded with columns the console does not edit", () => {
    const serverOwned = ["id", "code", "created_at", "last_updated", "deleted", "default", "in_use", "version", "orders_under_way", "order_versions", "action"];

    const stored = {
      workflow: {
        id: "w1",
        code: "W-1",
        draft_id: "d1",
        name: "Group order",
        description: "Farmers buy together",
        ordinality: 3,
        event_flows: "ask,answer",
        opens_in: "chat",
        created_at: "2026-11-01T08:00:00Z",
        last_updated: "2026-11-02T08:00:00Z",
        deleted: false,
        in_use: true,
        version: 2,
        orders_under_way: 1,
        order_versions: [2],
        a_later_workflow_column: { kept: true },
      },
      steps: [
        {
          id: "s1",
          code: "S-1",
          workflow_id: "w1",
          draft_id: "d1",
          title: "Ask the shop",
          description: "",
          ordinality: 7,
          prompt: "",
          kind: "fill_form",
          role_id: "r2",
          form_name: "Ask form",
          questions: [{ prompt: "Which?", answer_type: "free_text", required: true }],
          tool: "market_ask",
          agent_role_id: "r1",
          topic: "Shop questions",
          opening_line: "What do you need?",
          prompts: ["Tell me more"],
          tools: ["market_ask"],
          start_workflow_ids: ["w2"],
          a_later_step_column: "kept",
          created_at: "2026-11-01T08:00:00Z",
          last_updated: "2026-11-02T08:00:00Z",
          deleted: false,
          action: "Fills the Ask form",
        },
        { id: "s2", code: "S-2", workflow_id: "w1", draft_id: "d1", title: "Thank", ordinality: 8, kind: "notify", form_name: "Thanks", tool: "market_thank" },
      ],
      records: [
        {
          id: "c1",
          code: "C-1",
          workflow_id: "w1",
          draft_id: "d1",
          name: "Payments",
          role_id: "r1",
          form_name: "Payments",
          questions: [],
          a_later_record_column: 12,
          created_at: "2026-11-01T08:00:00Z",
          last_updated: "2026-11-02T08:00:00Z",
          deleted: false,
        },
      ],
    };

    const loaded = async () => {
      answers({
        ...hub,
        agency_get_workflow: stored.workflow,
        agency_list_work_items: { items: stored.steps },
        agency_list_records: { items: stored.records },
      });
      return (await loadDesign("h", "w1")).workflow;
    };

    it("sends back every column of the workflow, the step and the record that the edit did not touch", async () => {
      const before = await loaded();
      const after = {
        ...before,
        name: "Group orders",
        steps: before.steps.map((step, at) => (at === 0 ? { ...step, name: "Ask the shop again" } : step)),
        records: before.records.map((record) => ({ ...record, name: "Payments made" })),
      };

      await saveDesign("h", before, after);

      expect(callsTo("agency_update_workflow")).toEqual([
        {
          draft_id: "d1",
          workflow_id: "w1",
          name: "Group orders",
          description: "Farmers buy together",
          ordinality: 3,
          event_flows: "ask,answer",
          opens_in: "chat",
          a_later_workflow_column: { kept: true },
        },
      ]);
      const [first, second] = callsTo("agency_update_work_item");
      expect(first).toMatchObject({
        work_item_id: "s1",
        title: "Ask the shop again",
        tool: "market_ask",
        agent_role_id: "r1",
        topic: "Shop questions",
        opening_line: "What do you need?",
        prompts: ["Tell me more"],
        tools: ["market_ask"],
        start_workflow_ids: ["w2"],
        a_later_step_column: "kept",
      });
      expect(second).toMatchObject({ work_item_id: "s2", title: "Thank", tool: "market_thank" });
      expect(callsTo("agency_update_record")).toEqual([
        expect.objectContaining({ record_id: "c1", name: "Payments made", a_later_record_column: 12 }),
      ]);
    });

    it("sends the edit, and the place of the step, instead of what was loaded", async () => {
      const before = await loaded();
      const [ask, thank] = before.steps;

      await saveDesign("h", before, { ...before, steps: [thank, { ...ask, name: "Ask later", roleId: "r1" }] });

      const bodies = callsTo("agency_update_work_item");
      expect(bodies.map((body) => [body.work_item_id, body.ordinality])).toEqual([["s2", 1], ["s1", 2]]);
      expect(bodies[1]).toMatchObject({ title: "Ask later", role_id: "r1", tool: "market_ask" });
    });

    it("leaves out what the agency owns, which its update tools refuse as arguments", async () => {
      const before = await loaded();

      await saveDesign("h", before, { ...before, name: "Group orders" });

      const bodies = [...callsTo("agency_update_workflow"), ...callsTo("agency_update_work_item"), ...callsTo("agency_update_record")];
      expect(bodies).toHaveLength(4);
      for (const body of bodies) for (const key of serverOwned) expect(body).not.toHaveProperty(key);
    });

    it("sends a new step with only what the console knows", async () => {
      const before = await loaded();

      await saveDesign("h", before, { ...before, steps: [...before.steps, stepAt("Extra")] });

      const [made] = callsTo("agency_create_work_item");
      expect(made).not.toHaveProperty("tool");
      expect(made).not.toHaveProperty("a_later_step_column");
    });
  });

  it("refuses a workflow with no name and calls nothing", async () => {
    await expect(saveDesign("h", emptyWorkflow(), emptyWorkflow())).rejects.toThrow("name is required");
    expect(call).not.toHaveBeenCalled();
  });

  it("passes on the refusal of the tool", async () => {
    answers({ ...hub, agency_create_work_item: () => Promise.reject(new Error("a send_form step is always the agency's")) });

    await expect(saveDesign("h", emptyWorkflow(), { ...emptyWorkflow(), name: "A", steps: [stepAt("One")] })).rejects.toThrow("always the agency's");
  });
});
