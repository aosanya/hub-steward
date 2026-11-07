import { cleanup, screen, waitFor, within } from "@testing-library/react";
import type { Reply } from "../data/chatAnswer";
import { askModel } from "../data/modelChat";
import { McpError, callTool } from "../wakala/mcp";
import { cardNamed, cardShown, cards, chat, chipsOf, goTo, heading, main, mountConsole, pairsOf, user } from "./walkSupport";

vi.hoisted(() => {
  process.env.RTL_SKIP_AUTO_CLEANUP = "true";
});

vi.setConfig({ testTimeout: 30000 });

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

type Rec = Record<string, unknown>;

const roles: Rec[] = [
  { id: "r1", code: "R-1", name: "Group coordinator", description: "Runs the group order." },
  { id: "r2", code: "R-2", name: "Farmer", description: "Grows crops." },
  { id: "r3", code: "R-3", name: "Supplier", description: "Fills the order." },
];

const answerTypes = ["yes_no", "single_choice", "multi_select", "free_text", "date", "time", "number", "currency", "photo", "file"];

const workflows: Rec[] = [
  { id: "w1", code: "W-1", name: "Group order", description: "Farmers buy together", version: 2, in_use: true, orders_under_way: 1, order_versions: [2] },
  { id: "w2", code: "W-2", name: "Find it", description: "Looks for a supplier", version: 0, in_use: false },
];

const items: Rec[] = [
  {
    id: "s3",
    workflow_id: "w1",
    ordinality: 3,
    objective_id: "o1",
    title: "Answer the invitation",
    kind: "yes_no",
    role_id: "r2",
    sent_step_id: "s2",
  },
  {
    id: "s1",
    workflow_id: "w1",
    ordinality: 1,
    objective_id: "o1",
    title: "Start",
    kind: "fill_form",
    role_id: "r1",
    form_name: "Group order form",
    questions: [{ prompt: "Select the supplier", answer_type: "single_choice", required: true, options_from: "Farmer" }],
  },
  {
    id: "s2",
    workflow_id: "w1",
    ordinality: 2,
    objective_id: "o1",
    title: "Send the invitation",
    kind: "send_form",
    role_id: "",
    form_name: "Invitation",
    questions: [{ prompt: "Do you want to join this order?", answer_type: "yes_no", required: true }],
  },
  {
    id: "s4",
    workflow_id: "w2",
    ordinality: 1,
    objective_id: "o1",
    title: "Look up",
    kind: "fill_form",
    role_id: "r3",
    form_name: "Look up form",
    questions: [{ prompt: "Which product", answer_type: "free_text", required: true }],
  },
];

const records: Rec[] = [
  {
    id: "c1",
    workflow_id: "w1",
    name: "Payments",
    role_id: "r1",
    viewer_role_id: "r2",
    form_name: "Payments",
    questions: [{ prompt: "Enter the amount paid", answer_type: "currency", required: true }],
  },
];

const builtInCancel: Rec = { code: "cancel", name: "Cancel", description: "Cancels an order at once", in_use: true, version: 1 };

const scenarios: Rec[] = [
  { id: "sc1", name: "Buy together", summary: "", workflow_id: "w1", result: "not_run", actors: [{ id: "a1", name: "Farmer 1", role_id: "r2" }] },
  { id: "sc2", name: "A farmer stays silent", summary: "", workflow_id: "w1", result: "not_run", actors: [{ id: "a2", name: "Farmer 2", role_id: "r2" }] },
];

const underWay: Rec = {
  id: "run-1",
  name: "Order 41",
  workflow_code: "W-1",
  workflow_version: 2,
  status: "in_progress",
  started_at: "2026-10-29T08:30:00Z",
  step_due_at: "2026-10-31T10:00:00Z",
};

const olderOrder: Rec = {
  id: "run-0",
  name: "Order 38",
  workflow_code: "W-1",
  workflow_version: 1,
  status: "in_progress",
  started_at: "2026-10-27T08:30:00Z",
  step_due_at: "2026-10-30T10:00:00Z",
};

const orders: Rec[] = [underWay, olderOrder];

type Call = { tool: string; args: Rec };

const calls: Call[] = [];
const proposed: Rec[] = [];
const approvals: Rec[] = [];
const created: Record<string, string[]> = {};
const unknownWrites: string[] = [];
let sequence = 0;
let scenarioRefusals = 0;

const nextId = (kind: string) => {
  const id = `${kind}-${++sequence}`;
  created[kind] = [...(created[kind] ?? []), id];
  return id;
};

const without = (list: Rec[], key: string, value: unknown) => {
  const at = list.findIndex((entry) => entry[key] === value);
  if (at >= 0) list.splice(at, 1);
};

const merge = (list: Rec[], id: unknown, args: Rec) => {
  const found = list.find((entry) => entry.id === id);
  if (found) Object.assign(found, args);
  return {};
};

const stillUsedBy = (workflowId: unknown) => scenarios.filter((scenario) => scenario.workflow_id === workflowId);

const handlers: Record<string, (args: Rec) => unknown> = {
  ai_list_accounts: () => ({ items: [{ id: "a-1", name: "Muse Spark", status: "enabled", chat_enabled: true, chat_label: "Muse Spark 1.3", key_set: true }] }),
  agency_list_drafts: () => ({ items: [{ id: "d1", status: "open" }] }),
  agency_list_approvals: () => ({ items: approvals }),
  agency_list_pickers: () => ({ actors: roles.map((role) => ({ id: role.id, name: role.name, kind: "role" })), answer_types: answerTypes }),
  agency_list_objectives: () => ({ items: [{ id: "o1", code: "O-1", ordinality: 1 }] }),
  agency_list_workflow_objectives: (args) => ({ items: workflows.filter((workflow) => workflow.id === "w1" && (!args.workflow_id || args.workflow_id === "w1")).map((workflow) => ({ id: "wo1", workflow_id: workflow.id, objective_id: "o1" })) }),
  agency_list_workflows: () => ({ items: workflows }),
  agency_list_default_workflows: () => ({ items: [builtInCancel] }),
  agency_get_workflow: (args) => workflows.find((workflow) => workflow.id === args.workflow_id) ?? null,
  agency_list_work_items: () => ({ items }),
  agency_list_records: () => ({ items: records }),
  agency_create_workflow: (args) => {
    const id = nextId("workflow");
    workflows.push({ id, code: "W-" + (workflows.length + 1), name: args.name, description: args.description, cancels_order: args.cancels_order === true, version: 0, in_use: false });
    return { id };
  },
  agency_update_workflow: (args) => merge(workflows, args.workflow_id, { name: args.name, description: args.description }),
  agency_delete_workflow: (args) => {
    const mirrors = stillUsedBy(args.workflow_id);
    if (mirrors.length > 0) {
      const named = mirrors.map((scenario) => `"${scenario.name}"`).join(", ");
      throw new McpError(`agency_delete_workflow: used by a scenario: workflow is still used by ${named}`);
    }
    without(workflows, "id", args.workflow_id);
    return {};
  },
  agency_create_work_item: (args) => {
    const id = nextId("step");
    items.push({ ...args, id });
    return { id };
  },
  agency_update_work_item: (args) => merge(items, args.work_item_id, args),
  agency_delete_work_item: (args) => {
    without(items, "id", args.work_item_id);
    return {};
  },
  agency_create_record: (args) => {
    const id = nextId("record");
    records.push({ ...args, id });
    return { id };
  },
  agency_update_record: (args) => merge(records, args.record_id, args),
  agency_delete_record: (args) => {
    without(records, "id", args.record_id);
    return {};
  },
  agency_list_roles: () => ({ items: roles }),
  agency_get_role: (args) => roles.find((role) => role.id === args.role_id) ?? null,
  agency_update_role: (args) => {
    const role = roles.find((candidate) => candidate.id === args.role_id);
    if (role) role.name = String(args.name);
    return role ?? null;
  },
  agency_list_scenarios: () => ({ items: scenarios }),
  agency_delete_scenario: (args) => {
    if (scenarioRefusals > 0) {
      scenarioRefusals -= 1;
      throw new McpError("agency_delete_scenario: down");
    }
    without(scenarios, "id", args.scenario_id);
    return {};
  },
  agency_propose_write: (args) => {
    proposed.push({ kind: args.kind, summary: args.summary, payload: JSON.parse(String(args.payload)) });
    return { id: nextId("approval") };
  },
  taskmanager_workflow_run_list_under_way: () => ({ items: orders.filter((order) => order.status !== "closed") }),
  taskmanager_workflow_run_list_closed: () => ({ items: orders.filter((order) => order.status === "closed") }),
};

const fakeAgency = async (_hub: string, tool: string, args: Rec = {}) => {
  calls.push({ tool, args });
  const handler = handlers[tool];
  if (handler) return handler(args);
  if (/^agency_(create|update|delete)_/.test(tool)) unknownWrites.push(tool);
  return { items: [] };
};

const callsTo = (tool: string) => calls.filter((call) => call.tool === tool).map((call) => call.args);
const writes = () => calls.filter((call) => /^agency_(create|update|delete|propose)_/.test(call.tool));

const askModelMock = vi.mocked(askModel);

const noticeText = () => document.querySelector(".notice-text")?.textContent;

const chooseFromActions = async (card: HTMLElement, item: string) => {
  await user.click(within(card).getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: item }));
};

const askChat = async (reply: Reply, text: string) => {
  askModelMock.mockResolvedValue(reply);
  await waitFor(() => expect(chat().getByRole("button", { name: "Muse Spark 1.3" })).toBeInTheDocument());
  await user.type(chat().getByRole("textbox", { name: "Write a message" }), text + "{Enter}");
};

const chatSays = (sentence: string) => chat().findAllByText(sentence);

const unfoldCard = async (title: string) => {
  const section = (await screen.findByRole("heading", { name: title })).closest("section") as HTMLElement;
  await user.click(within(section).getByRole("button", { name: "Open" }));
};

const unfoldQuestions = async () => {
  for (const button of screen.queryAllByRole("button", { name: /^Question \d+:/ })) await user.click(button);
};

const editorTab = (name: string) => user.click(screen.getByRole("link", { name }));

beforeAll(() => {
  window.localStorage.clear();
  vi.mocked(callTool).mockImplementation(fakeAgency as unknown as typeof callTool);
  mountConsole();
});

afterAll(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.RTL_SKIP_AUTO_CLEANUP;
});

describe("journey 19, steps 1 to 7: the designer changes a rule", () => {
  it("1. Workflows lists the rules as cards with the built-in Cancel marked as a default, what is in use and the version of each", async () => {
    await goTo("Workflows");
    await cardShown("Group order");

    expect(cards().map((card) => card.querySelector(".cell-name")?.textContent)).toEqual(["Find it", "Group order", "Cancel"]);

    const groupOrder = cardNamed("Group order");
    expect(chipsOf(groupOrder)).toEqual(["W-1", "In use"]);
    expect(pairsOf(groupOrder)).toEqual({
      Steps: "3",
      Roles: "Group coordinator, The agency, Farmer",
      Objectives: "O-1",
      Version: "2",
    });
    expect(within(groupOrder).getByText("Farmers buy together")).toBeInTheDocument();
    cards().forEach((card) => expect(within(card).getByRole("button", { name: "Actions" })).toBeInTheDocument());

    const findIt = cardNamed("Find it");
    expect(chipsOf(findIt)).toEqual(["W-2"]);
    expect(pairsOf(findIt)).toMatchObject({ Steps: "1", Roles: "Supplier", Version: "—" });

    const cancel = cardNamed("Cancel");
    expect(chipsOf(cancel)).toEqual(["cancel", "Built-in default", "In use"]);
    expect(pairsOf(cancel)).toEqual({ Version: "1" });
    expect(within(cancel).queryByRole("link", { name: "Cancel" })).not.toBeInTheDocument();
    await user.click(within(cancel).getByRole("button", { name: "Actions" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Edit"]);
    await user.click(within(cancel).getByRole("button", { name: "Actions" }));

    expect(screen.getByText("A publish reaches members within 30 seconds.")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Add a workflow" })).toHaveAttribute("href", "/h/siaya/workflow-edit/new/workflow");
    expect(screen.getByRole("link", { name: "Add a cancel workflow" })).toHaveAttribute("href", "/h/siaya/workflow-edit/new/workflow?cancel=1");
    expect(writes()).toEqual([]);
  });

  it("2. opening Group order shows its steps as cards in order, each with its kind, its one actor, its action and the form it asks", async () => {
    await user.click(within(cardNamed("Group order")).getByRole("link", { name: "Group order" }));

    expect(await heading("Group order")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "1 · Start" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/siaya/workflow-edit/w1/workflow");

    const headings = main().getAllByRole("heading", { level: 2 }).map((entry) => entry.textContent);
    expect(headings).toEqual(["Workflow", "Steps", "1 · Start", "2 · Send the invitation", "3 · Answer the invitation"]);

    await waitFor(() => expect(pairsOf(cards()[0])).toMatchObject({ Version: "2", Objectives: "O-1Unlink", "Orders under way": "1, started on version 2, finishes on version 2", Records: "Payments" }));
    expect(screen.queryByText("Farmers buy together")).not.toBeInTheDocument();

    const stepCard = (title: string) => (screen.getByRole("heading", { level: 2, name: title }).closest("section") as HTMLElement);
    expect(pairsOf(stepCard("1 · Start"))).toMatchObject({
      Kind: "Fill a form",
      Actor: "Group coordinator",
      Action: "Fills the Group order form",
      Questions: "Select the supplier (Farmer)",
    });
    expect(pairsOf(stepCard("2 · Send the invitation"))).toMatchObject({
      Kind: "Send form",
      Actor: "The agency",
      Action: "Sends the invitation",
      Questions: "Do you want to join this order?",
    });
    expect(pairsOf(stepCard("3 · Answer the invitation"))).toMatchObject({
      Kind: "Say yes or no",
      Actor: "Farmer",
      Action: "Answers the invitation",
      "Answers the form sent in": "Send the invitation",
    });
    expect(writes()).toEqual([]);
  });

  it("3. Edit from the Actions menu opens the editor on Group order with the Workflow, Steps and Records tabs on one draft, and Save returns to the list with a notice that the change waits in the draft", async () => {
    await goTo("Workflows");
    await cardShown("Find it");
    await chooseFromActions(cardNamed("Group order"), "Edit");

    expect(await heading("Edit workflow")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^(Workflow|Steps|Records)$/ }).map((link) => link.textContent)).toEqual(["Workflow", "Steps", "Records"]);
    expect(await screen.findByLabelText("Name")).toHaveValue("Group order");
    expect(screen.getByLabelText("What it is for")).toHaveValue("Farmers buy together");
    await user.clear(screen.getByLabelText("What it is for"));
    await user.type(screen.getByLabelText("What it is for"), "Farmers buy together from one supplier");

    await editorTab("Steps");
    expect(await screen.findByRole("heading", { level: 2, name: "1 · Start" })).toBeInTheDocument();
    expect(main().getAllByRole("heading", { level: 2 }).map((entry) => entry.textContent ?? "").filter((name) => /^\d+ · /.test(name))).toEqual(["1 · Start", "2 · Send the invitation", "3 · Answer the invitation"]);
    expect(screen.getByLabelText("Actor")).toHaveDisplayValue("Group coordinator");

    await editorTab("Records");
    expect(await screen.findByRole("heading", { level: 2, name: "1 · Payments" })).toBeInTheDocument();
    expect(screen.getByLabelText("Who adds rows")).toHaveDisplayValue("Group coordinator");
    expect(screen.getByLabelText("Who sees rows")).toHaveDisplayValue("Farmer");
    await unfoldQuestions();
    expect(screen.getByLabelText("Question")).toHaveValue("Enter the amount paid");
    expect(writes()).toEqual([]);

    await editorTab("Workflow");
    expect(await screen.findByLabelText("What it is for")).toHaveValue("Farmers buy together from one supplier");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await heading("Workflows")).toBeInTheDocument();
    await waitFor(() => expect(noticeText()).toBe("The workflow was saved to the draft."));
    expect(document.querySelector(".notice")).toHaveAttribute("role", "status");
    expect(callsTo("agency_update_workflow")).toEqual([
      { draft_id: "d1", workflow_id: "w1", name: "Group order", description: "Farmers buy together from one supplier" },
    ]);
    expect(callsTo("agency_update_work_item").map((args) => args.work_item_id)).toEqual(["s1", "s2", "s3"]);
    callsTo("agency_update_work_item").forEach((args) => expect(args.draft_id).toBe("d1"));
    expect(callsTo("agency_update_record")).toEqual([expect.objectContaining({ record_id: "c1", role_id: "r1", viewer_role_id: "r2" })]);
    expect(callsTo("agency_create_workflow")).toEqual([]);
    expect(await screen.findByText("Farmers buy together from one supplier")).toBeInTheDocument();
  });

  it("4. Add a workflow opens the same three tabs empty; a name, a step with its actor and a record are added and Save puts the workflow in the draft", async () => {
    await user.click(screen.getByRole("link", { name: "Add a workflow" }));

    expect(await heading("Add a workflow")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^(Workflow|Steps|Records)$/ }).map((link) => link.textContent)).toEqual(["Workflow", "Steps", "Records"]);
    expect(await screen.findByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("What it is for")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await editorTab("Steps");
    expect(await screen.findByText("No steps yet.")).toBeInTheDocument();
    expect(within(screen.getByText("No steps yet.").closest(".empty") as HTMLElement).getByRole("button", { name: "Add a step" })).toBeInTheDocument();
    await editorTab("Records");
    expect(await screen.findByText("No records yet.")).toBeInTheDocument();

    await editorTab("Workflow");
    await user.type(await screen.findByLabelText("Name"), "Check the delivery");
    await user.type(screen.getByLabelText("What it is for"), "A Farmer counts what came");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    await editorTab("Steps");
    await user.click(await screen.findByRole("button", { name: "Add a step" }));
    await user.type(screen.getByLabelText("Name"), "Count the bags");
    await user.selectOptions(screen.getByLabelText("Kind"), "Fill a form");
    await user.selectOptions(screen.getByLabelText("Actor"), "Farmer");
    await user.type(screen.getByLabelText("Question"), "How many bags came");
    await user.click(screen.getByRole("button", { name: "Add a step" }));
    await user.type(screen.getByLabelText("Name"), "Confirm the count");
    await user.selectOptions(screen.getByLabelText("Kind"), "Say yes or no");
    await user.selectOptions(screen.getByLabelText("Actor"), "Supplier");

    await editorTab("Records");
    await user.click(await screen.findByRole("button", { name: "Add a record" }));
    await user.type(screen.getByLabelText("Name"), "Counts");
    await user.selectOptions(screen.getByLabelText("Who adds rows"), "Group coordinator");
    await user.type(screen.getByLabelText("Question"), "Bags");

    await editorTab("Workflow");
    expect(await screen.findByLabelText("Name")).toHaveValue("Check the delivery");
    expect(writes().filter((call) => call.tool.startsWith("agency_create"))).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await heading("Workflows")).toBeInTheDocument();
    await waitFor(() => expect(noticeText()).toBe("The workflow was saved to the draft."));
    const [madeWorkflow] = created.workflow;
    expect(callsTo("agency_create_workflow")).toEqual([{ draft_id: "d1", name: "Check the delivery", description: "A Farmer counts what came" }]);
    expect(callsTo("agency_create_work_item")).toHaveLength(2);
    expect(callsTo("agency_create_work_item")[1]).toMatchObject({ workflow_id: madeWorkflow, title: "Confirm the count", kind: "yes_no", role_id: "r3" });
    expect(callsTo("agency_create_work_item")[0]).toMatchObject({
      workflow_id: madeWorkflow,
      title: "Count the bags",
      kind: "fill_form",
      role_id: "r2",
      form_name: "Count the bags form",
      questions: [expect.objectContaining({ prompt: "How many bags came" })],
    });
    expect(callsTo("agency_create_record")).toHaveLength(1);
    expect(callsTo("agency_create_record")[0]).toMatchObject({
      workflow_id: madeWorkflow,
      name: "Counts",
      role_id: "r1",
      form_name: "Counts",
      questions: [expect.objectContaining({ prompt: "Bags" })],
    });

    const added = await waitFor(() => cardNamed("Check the delivery"));
    expect(pairsOf(added)).toMatchObject({ Steps: "2", Roles: "Farmer, Supplier", Objectives: "No objective yet. It cannot be published until it has one." });
  });

  it("5. the built-in Cancel opens an ask for a cancel workflow of the agency's own; asked in the chat, the form lands in the content area filled and Save records it", async () => {
    expect(within(cardNamed("Cancel")).getByText("Cancels an order at once")).toBeInTheDocument();
    await chooseFromActions(cardNamed("Cancel"), "Edit");

    expect(await heading("Add a cancel workflow")).toBeInTheDocument();
    expect(await screen.findByLabelText("Name")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await heading("Workflows")).toBeInTheDocument();
    const writesBefore = writes().length;

    const reply: Reply = {
      text: "Here is a cancel workflow. Check it, then press Save.",
      calls: [],
      answer: {
        kind: "form",
        form: "workflow",
        prompt: "Add a cancel workflow",
        fill: {
          name: "Cancel after the Supplier says yes",
          description: "A Farmer calls off an order after the Supplier has said yes",
          cancel: true,
          steps: [
            { name: "Say why", role: "Farmer", kind: "fill_form" },
            { name: "Say yes or no", role: "Supplier", kind: "yes_no" },
          ],
        },
      },
    };
    await askChat(reply, "Add a cancel workflow");

    expect(await heading("Add a cancel workflow")).toBeInTheDocument();
    expect(await screen.findByLabelText("Name")).toHaveValue("Cancel after the Supplier says yes");
    expect(screen.getByLabelText("What it is for")).toHaveValue("A Farmer calls off an order after the Supplier has said yes");
    expect(await chat().findByText(reply.text)).toBeInTheDocument();
    expect(writes()).toHaveLength(writesBefore);

    await editorTab("Steps");
    expect(await screen.findByRole("heading", { level: 2, name: "1 · Say why" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "2 · Say yes or no" })).toBeInTheDocument();
    expect(screen.getByLabelText("Actor")).toHaveDisplayValue("Farmer");
    await unfoldCard("2 · Say yes or no");
    expect(screen.getByLabelText("Actor")).toHaveDisplayValue("Supplier");
    expect(screen.getByLabelText("Kind")).toHaveDisplayValue("Say yes or no");

    await editorTab("Records");
    expect(await screen.findByText("No records yet.")).toBeInTheDocument();
    expect(writes()).toHaveLength(writesBefore);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await heading("Workflows")).toBeInTheDocument();
    await waitFor(() => expect(noticeText()).toBe("The workflow was saved to the draft."));
    const [madeCancel] = created.workflow.slice(-1);
    expect(callsTo("agency_create_workflow").at(-1)).toEqual({
      draft_id: "d1",
      name: "Cancel after the Supplier says yes",
      description: "A Farmer calls off an order after the Supplier has said yes",
      cancels_order: true,
    });
    const stepsMade = callsTo("agency_create_work_item").filter((args) => args.workflow_id === madeCancel);
    expect(stepsMade.map((args) => [args.title, args.kind, args.role_id])).toEqual([
      ["Say why", "fill_form", "r2"],
      ["Say yes or no", "yes_no", "r3"],
    ]);
    expect(callsTo("agency_create_record")).toHaveLength(1);
    expect(callsTo("agency_create_record").filter((args) => args.workflow_id === madeCancel)).toEqual([]);
    expect(pairsOf(cardNamed("Cancel after the Supplier says yes"))).toMatchObject({ Steps: "2", Roles: "Farmer, Supplier" });
  });

  it("6a. a role is edited straight away and its removal is refused while scenarios use it, in the content area and in the chat", async () => {
    await goTo("Roles");
    const farmer = (await screen.findByRole("button", { name: "Farmer" })).closest("section") as HTMLElement;
    await user.click(within(farmer).getByRole("link", { name: "Edit" }));
    expect(await heading("Farmer")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.clear(main().getByLabelText("Name *"));
    await user.type(main().getByLabelText("Name *"), "Grower");
    await user.click(main().getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(roles[1].name).toBe("Grower"));
    expect(callsTo("agency_update_role")).toHaveLength(1);
    expect(proposed).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Remove the Grower role? Its links to objectives go with it.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove role" }));

    const sentence = "The Grower role was not removed: 2 test scenarios use it. Take the Grower actor out of them first.";
    expect(await main().findByText(sentence)).toBeInTheDocument();
    expect(await chatSays(sentence)).toHaveLength(1);
    expect(main().getByRole("heading", { level: 2, name: "Scenarios that use Grower" })).toBeInTheDocument();
    const used = within(main().getByRole("table"));
    expect(used.getByText("Buy together")).toBeInTheDocument();
    expect(used.getByText("A farmer stays silent")).toBeInTheDocument();
    expect(used.getAllByRole("link", { name: "Open" }).map((link) => link.getAttribute("href"))).toEqual([
      "/h/siaya/test?open=sc1&tab=actors",
      "/h/siaya/test?open=sc2&tab=actors",
    ]);
    expect(proposed).toEqual([]);
    expect(callsTo("agency_delete_role")).toEqual([]);
    expect(roles.map((role) => role.name)).toEqual(["Group coordinator", "Grower", "Supplier"]);
  });

  it("6b. a workflow no scenario mirrors is removed after one question; one that scenarios mirror stays, and the chat and the content area both say why", async () => {
    await goTo("Workflows");
    await cardShown("Find it");

    await chooseFromActions(cardNamed("Find it"), "Remove");
    expect(screen.getByText("Remove Find it? Its steps go with it.")).toBeInTheDocument();
    expect(callsTo("agency_delete_workflow")).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Remove workflow" }));
    await waitFor(() => expect(screen.queryByText("Find it")).not.toBeInTheDocument());
    expect(callsTo("agency_delete_workflow")).toEqual([{ workflow_id: "w2" }]);
    expect(await chat().queryAllByText(/Find it was not removed/)).toEqual([]);

    await chooseFromActions(cardNamed("Group order"), "Remove");
    await user.click(screen.getByRole("button", { name: "Remove workflow" }));

    const sentence = "Group order was not removed: 2 test scenarios mirror it. Remove those scenarios first.";
    expect(await main().findByText(sentence)).toBeInTheDocument();
    expect(await chatSays(sentence)).toHaveLength(1);
    expect(main().getByRole("heading", { level: 2, name: "Scenarios that mirror Group order" })).toBeInTheDocument();
    const mirrors = within(main().getByRole("heading", { level: 2, name: /^Scenarios that mirror/ }).closest(".stack") as HTMLElement);
    expect(mirrors.getByRole("link", { name: "Buy together" })).toHaveAttribute("href", "/h/siaya/test?open=sc1");
    expect(mirrors.getByRole("link", { name: "A farmer stays silent" })).toHaveAttribute("href", "/h/siaya/test?open=sc2");
    expect(workflows.map((workflow) => workflow.name)).toContain("Group order");
  });

  it("6c. a scenario the agency refuses to remove stays and says so in both places; asked again it goes, and the workflow then names the one scenario left", async () => {
    await goTo("Test");
    await screen.findByText("A farmer stays silent");

    scenarioRefusals = 1;
    await chooseFromActions(cardNamed("A farmer stays silent"), "Remove");
    expect(screen.getByText(/^Remove A farmer stays silent\?/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove scenario" }));

    const sentence = "A farmer stays silent could not be removed.";
    expect(await main().findByText(sentence)).toHaveClass("empty", { exact: false });
    expect(await chatSays(sentence)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "A farmer stays silent" })).toBeInTheDocument();
    expect(scenarios).toHaveLength(2);

    await chooseFromActions(cardNamed("A farmer stays silent"), "Remove");
    await user.click(screen.getByRole("button", { name: "Remove scenario" }));
    await waitFor(() => expect(screen.queryByText("A farmer stays silent")).not.toBeInTheDocument());
    expect(scenarios.map((scenario) => scenario.name)).toEqual(["Buy together"]);
    expect(callsTo("agency_delete_scenario")).toHaveLength(2);
    expect(await chatSays(sentence)).toHaveLength(1);

    await goTo("Workflows");
    await cardShown("Group order");
    await chooseFromActions(cardNamed("Group order"), "Remove");
    await user.click(screen.getByRole("button", { name: "Remove workflow" }));

    const one = "Group order was not removed: 1 test scenario mirrors it. Remove that scenario first.";
    expect(await main().findByText(one)).toBeInTheDocument();
    expect(await chatSays(one)).toHaveLength(1);
    const mirrors = within(main().getByRole("heading", { level: 2, name: /^Scenarios that mirror/ }).closest(".stack") as HTMLElement);
    expect(mirrors.getAllByRole("link").map((link) => link.textContent)).toEqual(["Buy together"]);
    expect(workflows.map((workflow) => workflow.name)).toContain("Group order");
  });

  it("7. a step that waits on a person gets a time limit and the workflow that cancels the order when it passes; an incomplete limit is refused in the form", async () => {
    await goTo("Workflows");
    await cardShown("Group order");
    await chooseFromActions(cardNamed("Group order"), "Edit");
    await editorTab("Steps");

    await unfoldCard("3 · Answer the invitation");
    expect(await screen.findByLabelText("Time limit")).toBeInTheDocument();
    await unfoldCard("2 · Send the invitation");
    expect(screen.queryByLabelText("Time limit")).not.toBeInTheDocument();
    await unfoldCard("1 · Start");

    const limit = await screen.findByLabelText("Time limit");
    const picker = screen.getByLabelText("When it passes, run");
    expect(limit).toHaveValue("");
    expect(picker).toBeDisabled();
    const options = within(picker).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["", "Cancel after the Supplier says yes"]);

    const writesBefore = writes().length;
    await user.type(limit, "60");
    expect(picker).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pick the workflow that runs when the time limit passes.");
    expect(writes()).toHaveLength(writesBefore);

    await user.selectOptions(picker, "Cancel after the Supplier says yes");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await heading("Workflows")).toBeInTheDocument();
    await waitFor(() => expect(noticeText()).toBe("The workflow was saved to the draft."));
    const [madeCancel] = created.workflow.slice(-1);
    const updates = callsTo("agency_update_work_item").filter((args) => args.work_item_id === "s1");
    expect(updates.at(-1)).toMatchObject({ time_limit_minutes: 60, cancel_workflow_id: madeCancel });
    expect(callsTo("agency_update_work_item").filter((args) => args.work_item_id === "s2").at(-1)).toMatchObject({ time_limit_minutes: 0, cancel_workflow_id: "" });

    await user.click(within(cardNamed("Group order")).getByRole("link", { name: "Group order" }));
    const first = (await screen.findByRole("heading", { level: 2, name: "1 · Start" })).closest("section") as HTMLElement;
    expect(pairsOf(first)["Time limit"]).toBe("60 minutes, then Cancel after the Supplier says yes runs");
    const second = screen.getByRole("heading", { level: 2, name: "2 · Send the invitation" }).closest("section") as HTMLElement;
    expect(pairsOf(second)).not.toHaveProperty("Time limit");
  });

  it("8. Publish lists the scenario that has not passed and stays enabled with an approved change, and nothing reached members on the way", async () => {
    approvals.push({
      id: "ap1",
      kind: "agency_update_role",
      summary: "Rename the Farmer role to Grower",
      payload: JSON.stringify({ name: "Grower" }),
      decided_by: "Grace Adhiambo",
      decided_at: "2026-11-01T10:00:00Z",
    });
    await goTo("Publish");

    expect(await screen.findByRole("heading", { level: 2, name: "Scenarios that have not passed" })).toBeInTheDocument();
    const table = within(screen.getByRole("heading", { level: 2, name: "Scenarios that have not passed" }).closest("section") as HTMLElement);
    expect(table.getByRole("link", { name: "Buy together" })).toHaveAttribute("href", "/h/siaya/test?open=sc1");
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
    expect(callsTo("agency_publish_agency")).toEqual([]);
    expect(callsTo("agency_publish_draft")).toEqual([]);
    expect(callsTo("agency_publish")).toEqual([]);
  });

  it("9. across the whole journey every write went through a tool the agency owns, the draft id went with every create and update, and the removals the agency refused left their rows in place", () => {
    const named = (list: Call[]) => [...new Set(list.map((call) => call.tool))].sort();
    expect(named(calls.filter((call) => !/_(list|get)_/.test(call.tool)))).toEqual([
      "agency_create_record",
      "agency_create_work_item",
      "agency_create_workflow",
      "agency_delete_scenario",
      "agency_delete_workflow",
      "agency_update_record",
      "agency_update_role",
      "agency_update_work_item",
      "agency_update_workflow",
    ]);
    expect(Object.fromEntries(named(writes()).map((tool) => [tool, [...new Set(writes().filter((call) => call.tool === tool).map((call) => call.args.draft_id ?? null))]]))).toEqual({
      agency_create_record: ["d1"],
      agency_create_work_item: ["d1"],
      agency_create_workflow: ["d1"],
      agency_delete_scenario: [null],
      agency_delete_workflow: [null],
      agency_update_record: ["d1"],
      agency_update_role: ["d1"],
      agency_update_work_item: ["d1"],
      agency_update_workflow: ["d1"],
    });
    expect(unknownWrites).toEqual([]);
    expect(proposed).toEqual([]);
    expect(callsTo("agency_delete_workflow")).toEqual([{ workflow_id: "w2" }, { workflow_id: "w1" }, { workflow_id: "w1" }]);
    expect(workflows.map((workflow) => workflow.name)).toEqual(["Group order", "Check the delivery", "Cancel after the Supplier says yes"]);
  });
});
