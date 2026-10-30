import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reply } from "../data/chatAnswer";
import { askModel } from "../data/modelChat";
import { I18nProvider } from "../i18n";
import { TestPage } from "../pages/test/TestPage";
import { WorkflowEdit } from "../pages/workflows/WorkflowEdit";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { callTool } from "../wakala/mcp";
import { useConsole } from "./context";
import { Frame } from "./Frame";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const askModelMock = vi.mocked(askModel);

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const siaya: Hub = { id: "siaya", name: "Siaya Farmers", role: "owner", kind: "farmers' group", model_key_set: true };

const lab: Record<string, unknown> = {
  ai_list_accounts: { items: [{ id: "a-1", name: "Muse Spark", status: "enabled", chat_enabled: true, chat_label: "Muse Spark 1.3", key_set: true }] },
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_pickers: { actors: [{ id: "r2", name: "Farmer", kind: "role" }], answer_types: ["free_text"] },
  agency_list_workflows: { items: [{ id: "w2", name: "Group order" }] },
  agency_list_roles: { items: [{ id: "r2", name: "Farmer" }] },
};

const writes = () => callToolMock.mock.calls.filter(([, name]) => /^agency_(create|update|delete|propose)_/.test(String(name)));

function PageStub() {
  return <h1>{useConsole().page}</h1>;
}

function TestRoute() {
  return <TestPage hubId={useConsole().hub.id} />;
}

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
                <Route path="workflows" element={<PageStub />} />
                <Route path="workflow-edit/:id/:tab" element={<WorkflowEdit />} />
                <Route path="test" element={<TestRoute />} />
              </Route>
            </Routes>
          </Seed>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
};

const ask = async (user: ReturnType<typeof userEvent.setup>, reply: Reply, text: string) => {
  askModelMock.mockResolvedValue(reply);
  const chat = await screen.findByRole("complementary");
  await waitFor(() => expect(within(chat).getByRole("button", { name: "Muse Spark 1.3" })).toBeInTheDocument());
  await user.type(within(chat).getByRole("textbox", { name: "Write a message" }), text + "{Enter}");
  return chat;
};

beforeEach(() => {
  callToolMock.mockReset();
  askModelMock.mockReset();
  callToolMock.mockImplementation((async (_hub: string, tool: string) => (tool in lab ? lab[tool] : { items: [] })) as typeof callTool);
});

describe("asking the page chat to add something", () => {
  it("lands the filled cancel workflow form in the content area and keeps the sentence in the chat", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/workflows");
    await screen.findByRole("heading", { name: "workflows" });
    const reply: Reply = {
      text: "Here is a cancel workflow. Check it, then press Save.",
      calls: [],
      answer: {
        kind: "form",
        form: "workflow",
        prompt: "Add a cancel workflow",
        fill: { name: "Cancel after the Supplier says yes", description: "A Farmer calls off an order", cancel: true, steps: [] },
      },
    };

    const chat = await ask(user, reply, "Add a cancel workflow");

    expect(await screen.findByRole("heading", { level: 1, name: "Add a cancel workflow" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Name")).toHaveValue("Cancel after the Supplier says yes");
    expect(screen.getByLabelText("What it is for")).toHaveValue("A Farmer calls off an order");
    expect(within(chat).getByText(reply.text)).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("lands the filled scenario form on the Test page and records nothing", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/test");
    const reply: Reply = {
      text: "Here is the scenario. Check it, then press Save.",
      calls: [],
      answer: {
        kind: "form",
        form: "scenario",
        prompt: "Add a scenario where a farmer stays silent",
        fill: { name: "Group order: a farmer stays silent", summary: "The order waits", workflow: "Group order", actors: [{ name: "Farmer 2", role: "Farmer" }] },
      },
    };

    await ask(user, reply, "Add a scenario where a farmer stays silent");

    expect(await screen.findByDisplayValue("Group order: a farmer stays silent")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Group order")).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });
});
