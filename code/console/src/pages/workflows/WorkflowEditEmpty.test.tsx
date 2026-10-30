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

const words = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

const call = vi.mocked(callTool);

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
    answer_types: ["yes_no", "single_choice", "multi_select", "free_text", "date", "time", "number", "currency", "photo", "file"],
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
            <Route path="/h/:hubId/workflow-edit/:id/:tab" element={<WorkflowEdit />} />
            <Route path="/h/:hubId/workflows" element={<Where />} />
          </Routes>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );

describe("the Steps and Records tabs of a new workflow", () => {
  it("carry Add a step inside the empty card, and keep it above the cards once a step exists", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/new/steps");

    const empty = (await screen.findByText("No steps yet.")).closest(".empty") as HTMLElement;
    await user.click(within(empty).getByRole("button", { name: "Add a step" }));

    expect(screen.queryByText("No steps yet.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add a step" })).toHaveLength(1);
  });

  it("carry Add a record inside the empty card, and keep it above the cards once a record exists", async () => {
    const user = userEvent.setup();
    open("/h/h1/workflow-edit/new/records");

    const empty = (await screen.findByText("No records yet.")).closest(".empty") as HTMLElement;
    await user.click(within(empty).getByRole("button", { name: "Add a record" }));

    expect(screen.queryByText("No records yet.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add a record" })).toHaveLength(1);
  });
});
