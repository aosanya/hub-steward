import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formTarget } from "../../data/chatFill";
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

const hub = { id: "h1", name: "Siaya Farmers", role: "owner", model_key_set: true, manager_room_id: "room" };

const lab: Record<string, unknown> = {
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_pickers: {
    actors: [
      { id: "r1", name: "Group coordinator", kind: "role" },
      { id: "r2", name: "Farmer", kind: "role" },
    ],
    answer_types: ["yes_no", "free_text"],
  },
  agency_list_workflows: { items: [{ id: "w1", name: "Group order" }] },
  agency_list_objectives: { items: [{ id: "o1", code: "O-1" }] },
};

const writes = () => call.mock.calls.filter(([, name]) => /^agency_(create|update|delete)_/.test(String(name)));

beforeEach(() => {
  call.mockReset();
  call.mockImplementation((async (_hub: string, tool: string) => (tool in lab ? lab[tool] : { items: [] })) as typeof callTool);
});

const landed = formTarget("h1", {
  kind: "form",
  prompt: "Add a cancel workflow",
  form: "workflow",
  fill: {
    name: "Cancel after the Supplier says yes",
    description: "A Farmer calls off an order after the Supplier has said yes",
    cancel: true,
    steps: [{ name: "Tell the Supplier", role: "Farmer", kind: "notify" }],
  },
});

const open = () =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[{ pathname: landed.to.split("?")[0], search: "?cancel=1", state: landed.state }]}>
        <ConsoleCtx.Provider value={{ hub, page: "workflow-edit", setBadges: () => {}, refreshMenu: () => {} }}>
          <Routes>
            <Route path="/h/:hubId/workflow-edit/:id/:tab" element={<WorkflowEdit />} />
          </Routes>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );

describe("Add a cancel workflow filled by the chat", () => {
  it("lands with the name and the description filled and the cancel title", async () => {
    open();

    expect(await screen.findByRole("heading", { level: 1, name: "Add a cancel workflow" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Name")).toHaveValue("Cancel after the Supplier says yes");
    expect(screen.getByLabelText("What it is for")).toHaveValue("A Farmer calls off an order after the Supplier has said yes");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("carries the step to the Steps tab with its actor, and records nothing until Save", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("link", { name: "Steps" }));

    expect(await screen.findByDisplayValue("Tell the Supplier")).toBeInTheDocument();
    expect(screen.getByLabelText("Actor")).toHaveValue("r2");
    expect(writes()).toEqual([]);
  });

  it("records the workflow only when Save is pressed", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(writes().map(([, name]) => name)).toContain("agency_create_workflow");
  });
});
