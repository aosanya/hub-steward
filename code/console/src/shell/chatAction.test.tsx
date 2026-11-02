import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvalAction, formAction } from "../data/chatActions";
import type { Reply } from "../data/chatAnswer";
import { askModel } from "../data/modelChat";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { callTool, listTools } from "../wakala/mcp";
import { NoticeBar } from "../ui";
import { useConsole } from "./context";
import { Frame } from "./Frame";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);
const askModelMock = vi.mocked(askModel);

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const siaya: Hub = { id: "siaya", name: "Siaya Farmers", role: "owner", kind: "farmers' group", model_key_set: true };

const lab: Record<string, unknown> = {
  ai_list_accounts: { items: [{ id: "a-1", name: "Muse Spark", status: "enabled", chat_enabled: true, chat_label: "Muse Spark 1.3", key_set: true }] },
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
};

const setLimits = {
  name: "ai_set_limits",
  description: "Set the limits",
  inputSchema: { type: "object", properties: { instance_id: { type: "string" }, tokens_per_day: { type: "integer", description: "Tokens per day" } }, required: ["instance_id", "tokens_per_day"] },
};

const limitsWrites = () => callToolMock.mock.calls.filter(([, name]) => name === "ai_set_limits");

function PageStub() {
  return (
    <>
      <h1>{useConsole().page}</h1>
      <NoticeBar />
    </>
  );
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
                <Route path="models" element={<PageStub />} />
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
  window.localStorage.clear();
  callToolMock.mockReset();
  listToolsMock.mockReset();
  askModelMock.mockReset();
  listToolsMock.mockResolvedValue([setLimits]);
  callToolMock.mockImplementation((async (_hub: string, tool: string) => (tool in lab ? lab[tool] : { items: [] })) as typeof callTool);
});

describe("an action the chat puts in the content area", () => {
  it("draws the form under the prompt, leaves a compact card in the thread and records nothing until Save", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await screen.findByRole("heading", { name: "models" });
    const reply: Reply = {
      text: "Check it, then press Save.",
      calls: [],
      answer: formAction("Raise the daily tokens", "Raise the daily tokens", { tool: "ai_set_limits", show: ["tokens_per_day"], initial: { tokens_per_day: 100000 }, notice: "The limits were saved." }),
    };

    const chat = await ask(user, reply, "Raise the daily tokens");

    expect(await screen.findByLabelText(/tokens.per.day/i)).toHaveValue(100000);
    expect(within(chat).getByText("Raise the daily tokens", { selector: ".ref-title" })).toBeInTheDocument();
    expect(within(chat).getByText("Check it, then press Save.")).toBeInTheDocument();
    expect(limitsWrites()).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(limitsWrites()).toEqual([["siaya", "ai_set_limits", { tokens_per_day: 100000 }]]));
    await waitFor(() => expect(screen.queryByLabelText(/tokens.per.day/i)).toBeNull());
    expect(await screen.findByText("The limits were saved.")).toBeInTheDocument();
  });

  it("draws an approvable card in the content area and applies it on Approve", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await screen.findByRole("heading", { name: "models" });
    const reply: Reply = {
      text: "It needs your approval.",
      calls: [],
      answer: approvalAction("Raise the daily tokens", "Allow 200,000 tokens a day", { tool: "ai_set_limits", arguments: { tokens_per_day: 200000 }, text: "The agent stopped at 100,000." }),
    };

    await ask(user, reply, "Raise the daily tokens");

    expect(await screen.findByText("The agent stopped at 100,000.")).toBeInTheDocument();
    expect(limitsWrites()).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(limitsWrites()).toHaveLength(1));
    expect(limitsWrites()[0]).toEqual(["siaya", "ai_set_limits", { tokens_per_day: 200000 }]);
    await waitFor(() => expect(screen.queryByText("The agent stopped at 100,000.")).toBeNull());
  });

  it("clears the content area with the answer's Clear button and keeps the card in the thread", async () => {
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await screen.findByRole("heading", { name: "models" });
    const reply: Reply = {
      text: "Here.",
      calls: [],
      answer: approvalAction("Raise the daily tokens", "Allow 200,000 tokens a day", { tool: "ai_set_limits", arguments: {}, text: "The agent stopped." }),
    };

    const chat = await ask(user, reply, "Raise the daily tokens");
    await screen.findByText("The agent stopped.");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("The agent stopped.")).toBeNull();
    expect(within(chat).getByText("Allow 200,000 tokens a day")).toBeInTheDocument();
    expect(limitsWrites()).toEqual([]);
  });
});
