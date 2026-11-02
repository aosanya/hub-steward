import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { askModel } from "../data/modelChat";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { McpError, callTool } from "../wakala/mcp";
import { useFillChat } from "./chatTell";
import { Frame } from "./Frame";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const askModelMock = vi.mocked(askModel);

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const siaya: Hub = { id: "siaya", name: "Siaya Farmers", role: "owner", kind: "farmers' group", model_key_set: true };

const chatModel = { id: "a-1", name: "Muse Spark", status: "enabled", chat_enabled: true, chat_label: "Muse Spark 1.3", key_set: true };

const typedText = "Add a role for the treasurer.";

function Seed({ children }: { children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([siaya]);
    setReady(true);
  }, [startSession]);
  return ready ? <>{children}</> : null;
}

function FillPage() {
  const fill = useFillChat();
  return (
    <button type="button" onClick={() => fill(typedText)}>
      type into the chat
    </button>
  );
}

const openConsole = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://console.test").pathname;
      const data = path === "/instances" ? [{ id: "siaya", name: siaya.name, role: "owner", kind: siaya.kind }] : {};
      return { ok: true, status: 200, json: async () => data };
    }),
  );
  callToolMock.mockReset();
  callToolMock.mockImplementation(async (_hubId, tool) => {
    if (tool === "ai_list_accounts") return { items: [chatModel] } as never;
    if (tool === "agency_list_approvals") return { items: [] } as never;
    throw new McpError(`unexpected tool ${tool}`);
  });
  askModelMock.mockReset();
  return render(
    <MemoryRouter initialEntries={["/h/siaya/fill"]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Seed>
            <Routes>
              <Route path="/h/:hubId" element={<Frame />}>
                <Route path="fill" element={<FillPage />} />
              </Route>
            </Routes>
          </Seed>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
};

const chat = async () => within(await screen.findByRole("complementary", { name: "Chat" }));

beforeEach(() => localStorage.setItem("lang", "en"));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("a page filling the chat box through the shell", () => {
  it("puts the text in the message box and sends nothing", async () => {
    const user = userEvent.setup();
    openConsole();

    await user.click(await screen.findByRole("button", { name: "type into the chat" }));

    const box = (await chat()).getByRole("textbox", { name: "Write a message" });
    await waitFor(() => expect(box).toHaveValue(typedText));
    expect(box).toHaveFocus();
    expect(askModelMock).not.toHaveBeenCalled();
  });
});
