import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { WorkflowEdit } from "../pages/workflows/WorkflowEdit";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { callTool } from "../wakala/mcp";
import { Frame } from "./Frame";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

const callToolMock = vi.mocked(callTool);

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const siaya: Hub = { id: "siaya", name: "Siaya Farmers", role: "owner", kind: "farmers' group", model_key_set: true };

const lab: Record<string, unknown> = {
  ai_list_accounts: { items: [{ id: "a-1", name: "Muse Spark", status: "enabled", chat_enabled: true, chat_label: "Muse Spark 1.3", key_set: true }] },
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_pickers: { actors: [{ id: "r2", name: "Farmer", kind: "role" }], answer_types: ["free_text"] },
  agency_list_workflows: { items: [{ id: "w1", name: "Group order" }] },
  agency_get_workflow: { id: "w1", name: "Group order", description: "Farmers buy together" },
  agency_list_work_items: {
    items: [
      { id: "s1", workflow_id: "w1", ordinality: 1, title: "Start", kind: "fill_form", form_name: "Group order form" },
      { id: "s2", workflow_id: "w1", ordinality: 2, title: "Send", kind: "send_form", form_name: "Invitation" },
    ],
  },
};

function Seed({ children }: { children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([siaya]);
    setReady(true);
  }, [startSession]);
  return ready ? <>{children}</> : null;
}

const openConsole = (at: string) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://console.test").pathname;
      const data = path === "/instances" ? [{ id: "siaya", name: siaya.name, role: "owner", kind: siaya.kind }] : {};
      return { ok: true, status: 200, json: async () => data };
    }),
  );
  return render(
    <MemoryRouter initialEntries={[at]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Seed>
            <Routes>
              <Route path="/h/:hubId" element={<Frame />}>
                <Route path="workflows" element={<h1>Workflows page</h1>} />
                <Route path="workflow-edit/:id/:tab" element={<WorkflowEdit />} />
              </Route>
            </Routes>
          </Seed>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
};

const chipsOf = async () => {
  const chat = await screen.findByRole("complementary");
  await waitFor(() => expect(chat.querySelector(".chat-chips")).not.toBeNull());
  return within(chat);
};

beforeEach(() => {
  callToolMock.mockReset();
  callToolMock.mockImplementation((async (_hub: string, tool: string) => (tool in lab ? lab[tool] : { items: [] })) as typeof callTool);
});

describe("the chat chips on the workflow edit pages", () => {
  it.each(["workflow", "steps", "records"])("offer Add a cancel workflow and Add a step after the last step on the %s tab", async (tab) => {
    openConsole(`/h/siaya/workflow-edit/w1/${tab}`);
    await screen.findByRole("heading", { level: 1, name: "Edit workflow" });

    const chat = await chipsOf();

    await waitFor(() => expect(chat.getByRole("button", { name: "Add a step after Send" })).toHaveClass("sugg"));
    expect(chat.getByRole("button", { name: "Add a cancel workflow" })).toHaveClass("sugg");
    expect(chat.queryByRole("button", { name: "Show the workflows" })).toBeNull();
    expect(chat.queryByRole("button", { name: "What is not published?" })).toBeNull();
  });

  it("offer Add a cancel workflow alone on a new workflow with no step", async () => {
    openConsole("/h/siaya/workflow-edit/new/steps");
    await screen.findByRole("heading", { level: 1, name: "Add a workflow" });

    const chat = await chipsOf();

    expect(chat.getByRole("button", { name: "Add a cancel workflow" })).toBeInTheDocument();
    expect(chat.queryByRole("button", { name: /Add a step after/ })).toBeNull();
  });

  it("put the chip in the message box without sending it", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/workflow-edit/w1/steps");
    await screen.findByRole("heading", { level: 1, name: "Edit workflow" });
    const chat = await chipsOf();

    await user.click(await chat.findByRole("button", { name: "Add a step after Send" }));

    expect(chat.getByRole("textbox", { name: "Write a message" })).toHaveValue("Add a step after Send");
  });

  it("give the Workflows page its own chips again once the manager leaves the editor", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/workflow-edit/w1/steps");
    await screen.findByRole("heading", { level: 1, name: "Edit workflow" });
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    const chat = await chipsOf();

    expect(await screen.findByRole("heading", { name: "Workflows page" })).toBeInTheDocument();
    expect(chat.getByRole("button", { name: "Show the workflows" })).toBeInTheDocument();
    expect(chat.queryByRole("button", { name: /Add a step after/ })).toBeNull();
  });
});
