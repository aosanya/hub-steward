import { render, screen } from "@testing-library/react";
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

const words = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

const call = vi.mocked(callTool);

type Args = Record<string, unknown>;

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool).map(([, , args]) => args as Args);

const hub = { id: "h1", name: "Siaya Farmers", role: "owner", model_key_set: true, manager_room_id: "room" };

const lab: Record<string, unknown> = {
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_pickers: {
    actors: [
      { id: "a1", name: "The agency", kind: "agency" },
      { id: "r1", name: "Farmers' agent", kind: "role" },
      { id: "r2", name: "Farmer", kind: "role" },
    ],
    answer_types: ["free_text"],
  },
  agency_list_workflows: { items: [{ id: "w1", name: "Buy inputs", opens_in: "chat" }] },
  agency_get_workflow: { id: "w1", name: "Buy inputs", description: "Farmers find and buy farm inputs", opens_in: "chat" },
  agency_list_work_items: {
    items: [
      {
        id: "s1",
        workflow_id: "w1",
        ordinality: 1,
        title: "Chat with an agent",
        kind: "chat",
        role_id: "r2",
        agent_role_id: "r1",
        topic: "Buying farm inputs",
        opening_line: "What do you need?",
        prompts: ["See what is on sale"],
        tools: ["market_list_offers"],
        start_workflow_ids: ["w2"],
      },
    ],
  },
};

let served: Record<string, unknown> = lab;

beforeEach(() => {
  served = lab;
  call.mockReset();
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool in served) return served[tool];
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
        <ConsoleCtx.Provider value={{ hub, page: "workflow-edit", setBadges: () => {}, refreshMenu: () => {} }}>
          <Routes>
            <Route path="/h/:hubId/workflow-edit/:id/:tab" element={<WorkflowEdit />} />
            <Route path="/h/:hubId/workflows" element={<Where />} />
          </Routes>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );

describe("Edit a workflow that opens in a chat", () => {
  it("shows its chat step as a chat step, with the role that opens it and nothing to change", async () => {
    open("/h/h1/workflow-edit/w1/steps");

    expect(await screen.findByRole("heading", { name: "1 · Chat with an agent" })).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Farmer · Chats with an agent")).toBeInTheDocument();
    expect(screen.queryByLabelText("Kind")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument();
  });

  it("saves the chat step as a chat step when only the workflow's name was changed", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/workflow");
    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Buy farm inputs");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByTestId("where")).toHaveTextContent("/h/h1/workflows");
    expect(callsTo("agency_update_workflow")[0]).toMatchObject({ workflow_id: "w1", name: "Buy farm inputs", opens_in: "chat" });
    expect(callsTo("agency_update_work_item")).toEqual([
      expect.objectContaining({
        work_item_id: "s1",
        kind: "chat",
        role_id: "r2",
        agent_role_id: "r1",
        topic: "Buying farm inputs",
        opening_line: "What do you need?",
        prompts: ["See what is on sale"],
        tools: ["market_list_offers"],
        start_workflow_ids: ["w2"],
      }),
    ]);
  });
});

describe("The steps after the locked chat step", () => {
  const afterChat = (...titles: string[]) => ({
    ...lab,
    agency_list_work_items: {
      items: [
        ...(lab.agency_list_work_items as { items: object[] }).items,
        ...titles.map((title, at) => ({ id: `n${at}`, workflow_id: "w1", ordinality: at + 2, title, kind: "notify", form_name: title })),
      ],
    },
  });

  const order = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

  it("cannot move the step right after the chat step above it, and the chat step has no Up or Down", async () => {
    served = afterChat("Thank you");
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/steps");
    await screen.findByRole("heading", { name: "2 · Thank you" });

    const up = screen.getByRole("button", { name: "Up" });
    expect(screen.getAllByRole("button", { name: "Up" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Down" })).toHaveLength(1);
    expect(up).toBeDisabled();
    await user.click(up);

    expect(order()).toEqual(["1 · Chat with an agent", "2 · Thank you"]);
  });

  it("moves a later step up as far as the place right after the chat step, and no further", async () => {
    served = afterChat("Thank you", "Tell the Supplier");
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/steps");
    await screen.findByRole("heading", { name: "3 · Tell the Supplier" });

    const ups = screen.getAllByRole("button", { name: "Up" });
    expect(ups[0]).toBeDisabled();
    expect(ups[1]).toBeEnabled();
    await user.click(ups[1]);

    expect(order()).toEqual(["1 · Chat with an agent", "2 · Tell the Supplier", "3 · Thank you"]);
    expect(screen.getAllByRole("button", { name: "Up" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Up" })[1]).toBeEnabled();
  });
});

describe("Opens in on the Workflow tab", () => {
  const formWorkflow = (more: Record<string, unknown> = {}) => ({
    ...lab,
    agency_get_workflow: { id: "w1", name: "Group order", description: "Farmers buy together", ...more },
    agency_list_work_items: { items: [{ id: "s1", workflow_id: "w1", ordinality: 1, title: "Start", kind: "fill_form", role_id: "r2", form_name: "Start form" }] },
  });

  it("is a choice between A chat and A form, with A form chosen, on a workflow not yet made", async () => {
    open("/h/h1/workflow-edit/new/workflow");

    expect(await screen.findByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A form" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "A chat" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "A chat" })).toBeEnabled();
  });

  it("creates a workflow that opens in a chat when A chat is chosen, and says nothing of it when A form stays chosen", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/new/workflow");
    await user.type(await screen.findByLabelText("Name"), "Buy inputs");
    await user.click(screen.getByRole("radio", { name: "A chat" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByTestId("where");
    expect(callsTo("agency_create_workflow")).toEqual([{ draft_id: "d1", name: "Buy inputs", description: "", opens_in: "chat" }]);
  });

  it("leaves opens_in out of a new workflow that opens in a form", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/new/workflow");
    await user.type(await screen.findByLabelText("Name"), "Group order");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByTestId("where");
    expect(callsTo("agency_create_workflow")[0]).not.toHaveProperty("opens_in");
  });

  it("is shown on Edit with what the workflow opens in chosen, and can be changed while no order is under way", async () => {
    served = formWorkflow({ orders_under_way: 0 });
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/workflow");

    expect(await screen.findByRole("radio", { name: "A form" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "A chat" })).toBeEnabled();
    await user.click(screen.getByRole("radio", { name: "A chat" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByTestId("where");
    expect(callsTo("agency_update_workflow")[0]).toMatchObject({ workflow_id: "w1", opens_in: "chat" });
  });

  it("cannot be changed on Edit while an order is under way", async () => {
    served = formWorkflow({ orders_under_way: 2 });
    open("/h/h1/workflow-edit/w1/workflow");

    expect(await screen.findByRole("radio", { name: "A form" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "A form" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "A chat" })).toBeDisabled();
  });

  it("cannot be changed on Edit while the workflow holds its chat step", async () => {
    open("/h/h1/workflow-edit/w1/workflow");

    expect(await screen.findByRole("radio", { name: "A chat" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "A form" })).toBeDisabled();
  });

  it("sends a workflow back to a form by leaving opens_in out, when it holds no chat step", async () => {
    served = { ...lab, agency_list_work_items: { items: [] } };
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/w1/workflow");
    await user.click(await screen.findByRole("radio", { name: "A form" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByTestId("where");
    expect(callsTo("agency_update_workflow")[0]).not.toHaveProperty("opens_in");
  });
});
