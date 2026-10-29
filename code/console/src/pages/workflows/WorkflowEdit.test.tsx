import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import { callTool } from "../../wakala/mcp";
import { WorkflowEdit } from "./WorkflowEdit";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const words = JSON.parse(
  readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"),
);

const call = vi.mocked(callTool);

const unfold = async (user: ReturnType<typeof userEvent.setup>) => {
  for (const toggle of screen.getAllByRole("button", {
    name: /^Question \d+:/,
  }))
    await user.click(toggle);
};

type Args = Record<string, unknown>;

const callsTo = (tool: string) =>
  call.mock.calls
    .filter(([, name]) => name === tool)
    .map(([, , args]) => args as Args);

const hub = {
  id: "h1",
  name: "Siaya Farmers",
  role: "owner",
  model_key_set: true,
  manager_room_id: "room",
};

const lab: Record<string, unknown> = {
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_pickers: {
    actors: [
      { id: "a1", name: "The agency", kind: "agency" },
      { id: "r1", name: "Group coordinator", kind: "role" },
      { id: "r2", name: "Farmer", kind: "role" },
    ],
    answer_types: [
      "yes_no",
      "single_choice",
      "multi_select",
      "free_text",
      "date",
      "time",
      "number",
      "currency",
      "photo",
      "file",
    ],
  },
  agency_list_workflows: {
    items: [
      { id: "w1", name: "Group order" },
      { id: "w2", name: "Cancel before" },
    ],
  },
  agency_list_objectives: { items: [{ id: "o1", code: "O-1" }] },
  agency_get_workflow: {
    id: "w1",
    name: "Group order",
    description: "Farmers buy together",
  },
  agency_list_work_items: {
    items: [
      {
        id: "s1",
        workflow_id: "w1",
        ordinality: 1,
        objective_id: "o1",
        title: "Start",
        kind: "fill_form",
        role_id: "r1",
        form_name: "Group order form",
        questions: [
          {
            prompt: "Select the supplier",
            answer_type: "single_choice",
            required: true,
            options_from: "Farmer",
          },
        ],
      },
      {
        id: "s2",
        workflow_id: "w1",
        ordinality: 2,
        objective_id: "o1",
        title: "Send the invitation",
        kind: "send_form",
        form_name: "Invitation",
        questions: [
          {
            prompt: "Do you want to join this order?",
            answer_type: "yes_no",
            required: true,
          },
        ],
      },
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
    ],
  },
  agency_list_records: {
    items: [
      {
        id: "c1",
        workflow_id: "w1",
        name: "Payments",
        role_id: "r1",
        viewer_role_id: "r2",
        form_name: "Payments",
        questions: [
          {
            prompt: "Select the farmer",
            answer_type: "single_choice",
            required: true,
            options_from: "Farmer",
          },
          {
            prompt: "Enter the amount paid",
            answer_type: "currency",
            required: true,
          },
        ],
      },
    ],
  },
};

beforeEach(() => {
  call.mockReset();
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool in lab) return lab[tool];
    return /^agency_create_/.test(tool) ? { id: "made" } : { items: [] };
  }) as typeof callTool);
});

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

const open = (path: string) =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[path]}>
        <ConsoleCtx.Provider
          value={{
            hub,
            page: "workflow-edit",
            setBadges: () => {},
            refreshMenu: () => {},
          }}
        >
          <Routes>
            <Route
              path="/h/:hubId/workflow-edit/:id/:tab"
              element={<WorkflowEdit />}
            />
            <Route path="/h/:hubId/workflows" element={<Where />} />
          </Routes>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );

describe("Add a workflow", () => {
  it("is titled Add a workflow, has the Workflow, Steps and Records tabs and nothing filled in", async () => {
    open("/h/h1/workflow-edit/new/workflow");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Add a workflow" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["Workflow", "Steps", "Records"],
    );
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("What it is for")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("is titled Add a cancel workflow when asked for one", async () => {
    open("/h/h1/workflow-edit/new/workflow?cancel=1");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Add a cancel workflow",
      }),
    ).toBeInTheDocument();
  });

  it("says there are no steps and no records yet", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/new/steps");
    expect(await screen.findByText("No steps yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Records" }));
    expect(await screen.findByText("No records yet.")).toBeInTheDocument();
  });

  it("offers a question the forms module's ten answer types, named in the page's language", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/new/steps");
    await user.click(await screen.findByRole("button", { name: "Add a step" }));

    const labels = within(screen.getByLabelText("Type"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(labels).toEqual([
      "Yes or no",
      "Pick one",
      "Pick several",
      "Text",
      "Date",
      "Time",
      "Number",
      "Amount of money",
      "Photo",
      "File",
    ]);
    await user.selectOptions(screen.getByLabelText("Type"), "Pick several");
    expect(screen.getByLabelText("Picks from")).toBeInTheDocument();
  });

  it("keeps what was typed on one tab while another is open, and saves the workflow, its step and its record", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/new/workflow");
    await user.type(await screen.findByLabelText("Name"), "Cancel after yes");
    await user.type(
      screen.getByLabelText("What it is for"),
      "A Farmer calls off an order",
    );

    await user.click(screen.getByRole("link", { name: "Steps" }));
    await user.click(await screen.findByRole("button", { name: "Add a step" }));
    await user.type(screen.getByLabelText("Name"), "Cancel");
    await user.selectOptions(screen.getByLabelText("Actor"), "Farmer");
    await user.type(
      screen.getByLabelText("Question"),
      "Say why the order is called off",
    );

    await user.click(screen.getByRole("link", { name: "Records" }));
    await user.click(
      await screen.findByRole("button", { name: "Add a record" }),
    );
    await user.type(screen.getByLabelText("Name"), "Reasons");
    await user.selectOptions(
      screen.getByLabelText("Who adds rows"),
      "Group coordinator",
    );
    expect(screen.getByLabelText("Who sees rows")).toHaveValue("");
    await user.selectOptions(screen.getByLabelText("Who sees rows"), "Farmer");
    await user.type(screen.getByLabelText("Question"), "Why");

    await user.click(screen.getByRole("link", { name: "Workflow" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Cancel after yes");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/h/h1/workflows",
    );
    expect(callsTo("agency_create_workflow")).toEqual([
      {
        draft_id: "d1",
        name: "Cancel after yes",
        description: "A Farmer calls off an order",
      },
    ]);
    expect(callsTo("agency_create_work_item")[0]).toMatchObject({
      title: "Cancel",
      kind: "fill_form",
      role_id: "r2",
    });
    expect(callsTo("agency_create_work_item")[0]).not.toHaveProperty(
      "objective_id",
    );
    expect(callsTo("agency_create_record")[0]).toMatchObject({
      name: "Reasons",
      role_id: "r1",
      viewer_role_id: "r2",
    });
  });

  it("shows the tool's refusal and stays on the form", async () => {
    call.mockImplementation((async (_hub: string, tool: string) => {
      if (tool === "agency_create_workflow")
        throw new Error("agency_create_workflow: that name is taken");
      return lab[tool] ?? { items: [] };
    }) as typeof callTool);
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/new/workflow");
    await user.type(await screen.findByLabelText("Name"), "Group order");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "that name is taken",
    );
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });
});

describe("Edit a workflow", () => {
  it("fills the Workflow tab from the workflow", async () => {
    open("/h/h1/workflow-edit/w1/workflow");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Edit workflow" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Group order");
    expect(screen.getByLabelText("What it is for")).toHaveValue(
      "Farmers buy together",
    );
  });

  it("shows each step with its number, kind, actor and action, the first one open and the others folded", async () => {
    open("/h/h1/workflow-edit/w1/steps");

    expect(
      await screen.findByRole("heading", { name: "1 · Start" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2 · Send the invitation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Group coordinator · Fills the Group order form"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The agency · Sends the invitation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Farmer · Answers the invitation"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
    await unfold(userEvent.setup());
    expect(screen.getAllByLabelText("Question")).toHaveLength(1);
    expect(screen.getByLabelText("Question")).toHaveValue(
      "Select the supplier",
    );
  });

  it("opens one step at a time", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/steps");
    await screen.findByRole("heading", { name: "1 · Start" });

    await user.click(
      within(
        screen
          .getByRole("heading", { name: "2 · Send the invitation" })
          .closest("section") as HTMLElement,
      ).getByRole("button", { name: "Open" }),
    );

    await unfold(user);
    expect(screen.getByLabelText("Question")).toHaveValue(
      "Do you want to join this order?",
    );
    expect(screen.getAllByLabelText("Question")).toHaveLength(1);
  });

  it("shows a Send form step's actor as the agency, which cannot be changed", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/steps");
    await user.click(
      within(
        (
          await screen.findByRole("heading", {
            name: "2 · Send the invitation",
          })
        ).closest("section") as HTMLElement,
      ).getByRole("button", { name: "Open" }),
    );

    expect(screen.getByLabelText("Actor")).toBeDisabled();
    expect(screen.getByLabelText("Actor")).toHaveDisplayValue("The agency");
    expect(screen.getByLabelText("Sends to")).toHaveDisplayValue("All");
  });

  it("shows a step that answers a sent form with the form it answers and no questions of its own", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/steps");
    await user.click(
      within(
        (
          await screen.findByRole("heading", {
            name: "3 · Answer the invitation",
          })
        ).closest("section") as HTMLElement,
      ).getByRole("button", { name: "Open" }),
    );

    expect(
      screen.getByLabelText("Answers the form sent in"),
    ).toHaveDisplayValue("Send the invitation");
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
  });

  it("offers the six kinds and changes the action when the kind changes", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/steps");
    await screen.findByRole("heading", { name: "1 · Start" });

    expect(
      within(screen.getByLabelText("Kind"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Fill a form",
      "Send form",
      "Notify",
      "Say yes or no",
      "Route",
      "Run another workflow",
    ]);
    await user.selectOptions(screen.getByLabelText("Kind"), "Route");

    expect(
      screen.getByText("The agency · Routes the answers"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Actor")).toBeDisabled();
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
  });

  it("lists a Yes and a No destination for a form that asks a yes or no, with no route to add", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/steps");
    await screen.findByRole("heading", { name: "1 · Start" });
    await user.selectOptions(screen.getByLabelText("Kind"), "Route");
    await user.selectOptions(
      screen.getByLabelText("Check the answers to"),
      "Send the invitation",
    );

    expect(
      screen.queryByRole("button", { name: "Add a route" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("If yes, go to")).toHaveDisplayValue(
      "The next step",
    );
    await user.selectOptions(
      screen.getByLabelText("If no, go to"),
      "3 · Answer the invitation",
    );
    expect(screen.getByLabelText("If no, go to")).toHaveDisplayValue(
      "3 · Answer the invitation",
    );
  });

  it("adds a thank-you step at the end when No is sent to a new thank-you step", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/steps");
    await screen.findByRole("heading", { name: "1 · Start" });
    await user.selectOptions(screen.getByLabelText("Kind"), "Route");
    await user.selectOptions(
      screen.getByLabelText("Check the answers to"),
      "Send the invitation",
    );
    await user.selectOptions(
      screen.getByLabelText("If no, go to"),
      "New thank-you step",
    );

    expect(
      await screen.findByRole("heading", { name: /^\d+ · Thank you$/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("If no, go to")).toHaveDisplayValue(
      /Thank you$/,
    );
  });

  it("shows the Payments record on the Records tab with its role and its two questions", async () => {
    open("/h/h1/workflow-edit/w1/records");

    expect(
      await screen.findByRole("heading", { name: "1 · Payments" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Who adds rows")).toHaveDisplayValue(
      "Group coordinator",
    );
    expect(screen.getByLabelText("Who sees rows")).toHaveDisplayValue("Farmer");
    await unfold(userEvent.setup());
    expect(
      screen
        .getAllByLabelText("Question")
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(["Select the farmer", "Enter the amount paid"]);
  });

  it("moves a question down and disables Up on the first and Down on the last", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/records");
    await screen.findByRole("heading", { name: "1 · Payments" });

    await unfold(user);
    const ups = screen.getAllByRole("button", { name: "Up" });
    const downs = screen.getAllByRole("button", { name: "Down" });
    expect(ups[0]).toBeDisabled();
    expect(downs[1]).toBeDisabled();
    await user.click(downs[0]);

    expect(
      screen
        .getAllByLabelText("Question")
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(["Enter the amount paid", "Select the farmer"]);
  });

  it("saves changes by updating the workflow and the steps it already has", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/workflow");
    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Group orders");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByTestId("where")).toBeInTheDocument();
    expect(callsTo("agency_update_workflow")).toEqual([
      {
        draft_id: "d1",
        name: "Group orders",
        description: "Farmers buy together",
        workflow_id: "w1",
      },
    ]);
    expect(
      callsTo("agency_update_work_item").map((args) => args.work_item_id),
    ).toEqual(["s1", "s2", "s3"]);
    expect(callsTo("agency_update_work_item")[2]).toMatchObject({
      sent_step_id: "s2",
      kind: "yes_no",
      role_id: "r2",
    });
    expect(callsTo("agency_create_work_item")).toEqual([]);
    expect(callsTo("agency_delete_work_item")).toEqual([]);
  });

  it("says the page could not be loaded when the workflow cannot be read", async () => {
    call.mockImplementation((async (_hub: string, tool: string) => {
      if (tool === "agency_get_workflow") throw new Error("down");
      return lab[tool] ?? { items: [] };
    }) as typeof callTool);
    open("/h/h1/workflow-edit/w1/workflow");

    expect(
      await screen.findByText("The page could not be loaded."),
    ).toBeInTheDocument();
  });

  it("goes back to the workflows when cancelled", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/workflow");
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/h/h1/workflows",
    );
  });
});
