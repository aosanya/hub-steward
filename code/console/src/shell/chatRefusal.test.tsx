import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RolesView } from "../pages/views/RolesView";
import { TestView } from "../pages/views/TestView";
import { WorkflowsView } from "../pages/views/WorkflowsView";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { McpError, callTool } from "../wakala/mcp";
import { Frame } from "./Frame";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const callToolMock = vi.mocked(callTool);

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const siaya: Hub = { id: "siaya", name: "Siaya Farmers", role: "owner", kind: "farmers' group", model_key_set: true };

const scenario = (id: string, name: string, workflowId: string, roleId: string) => ({
  id,
  name,
  summary: "",
  workflow_id: workflowId,
  result: "not_run",
  actors: [{ id: id + "a", name: "Actor", role_id: roleId }],
});

let replies: Record<string, unknown> = {};

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
                <Route path="roles" element={<RolesView />} />
                <Route path="workflows" element={<WorkflowsView />} />
                <Route path="test" element={<TestView />} />
              </Route>
            </Routes>
          </Seed>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
};

const chat = async () => within(await screen.findByRole("complementary", { name: "Chat" }));

const content = () => within(document.querySelector("main") as HTMLElement);

const chooseRemove = async (user: ReturnType<typeof userEvent.setup>, card: string) => {
  const holder = (await screen.findByText(card)).closest(".card") as HTMLElement;
  await user.click(within(holder).getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Remove" }));
};

beforeEach(() => {
  window.localStorage.clear();
  replies = {
    agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
    agency_list_roles: { items: [{ id: "r2", code: "R-2", name: "Farmer", description: "Grows crops." }] },
    agency_get_role: { id: "r2", name: "Farmer", description: "Grows crops." },
    agency_list_workflows: { items: [{ id: "w1", code: "W-1", name: "Group order", description: "" }] },
    agency_list_scenarios: { items: [scenario("s1", "Buy together", "w1", "r2"), scenario("s2", "A farmer stays silent", "w1", "r2")] },
  };
  callToolMock.mockReset();
  callToolMock.mockImplementation((async (_hub: string, tool: string) => {
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return reply === undefined ? { items: [] } : reply;
  }) as typeof callTool);
});

describe("a refused removal says why in the chat as well as in the content area", () => {
  it("a role that scenarios still use", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/roles?open=r2");
    await screen.findByRole("heading", { level: 1, name: "Farmer" });

    await user.click(await screen.findByRole("button", { name: "Remove" }));
    await user.click(await screen.findByRole("button", { name: "Remove role" }));

    const sentence = "The Farmer role was not removed: 2 test scenarios use it. Take the Farmer actor out of them first.";
    expect(await content().findByText(sentence)).toBeInTheDocument();
    expect(await (await chat()).findByText(sentence)).toBeInTheDocument();
  });

  it("a workflow that scenarios mirror", async () => {
    const user = userEvent.setup();
    replies.agency_delete_workflow = new McpError('agency_delete_workflow: workflow "Group order" is still used by "Buy together", "A farmer stays silent"');
    openConsole("/h/siaya/workflows");
    await chooseRemove(user, "Group order");

    await user.click(screen.getByRole("button", { name: "Remove workflow" }));

    const sentence = "Group order was not removed: 2 test scenarios mirror it. Remove those scenarios first.";
    expect(await content().findByText(sentence)).toBeInTheDocument();
    expect(await (await chat()).findByText(sentence)).toBeInTheDocument();
  });

  it("a scenario the agency refuses to remove", async () => {
    const user = userEvent.setup();
    replies.agency_delete_scenario = new McpError("agency_delete_scenario: down");
    openConsole("/h/siaya/test");
    await chooseRemove(user, "Buy together");

    await user.click(screen.getByRole("button", { name: "Remove scenario" }));

    const sentence = "Buy together could not be removed.";
    expect(await content().findByText(sentence)).toBeInTheDocument();
    expect(await (await chat()).findByText(sentence)).toBeInTheDocument();
  });

  it("says nothing in the chat when the removal goes through", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/test");
    await chooseRemove(user, "Buy together");

    await user.click(screen.getByRole("button", { name: "Remove scenario" }));

    await screen.findByText("Buy together");
    expect((await chat()).queryByText(/could not be removed/)).not.toBeInTheDocument();
  });
});
