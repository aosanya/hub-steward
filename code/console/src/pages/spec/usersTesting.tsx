import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentType } from "react";
import { MemoryRouter, Outlet, Route, Routes, useParams } from "react-router-dom";
import { vi } from "vitest";
import { hubPath } from "../../api";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import { callTool } from "../../wakala/mcp";

const words: Record<string, Record<string, string>> = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

export type Args = Record<string, unknown>;

export type ToolReply = unknown | ((args: Args) => unknown);

const call = vi.mocked(callTool);

export const answering = (replies: Record<string, ToolReply>) =>
  call.mockImplementation((async (_hub: string, tool: string, args: Args = {}) => {
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    if (typeof reply === "function") return reply(args);
    return reply === undefined ? { items: [] } : reply;
  }) as typeof callTool);

export const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool).map(([, , args]) => args ?? {});

export const proposals = () =>
  callsTo("agency_propose_write").map((args) => ({ kind: args.kind, summary: args.summary, payload: JSON.parse(String(args.payload)) }));

const hub = { id: "h1", name: "Siaya Boda Boda Riders", role: "owner", model_key_set: true, manager_room_id: "room-m" };

function Frame() {
  const { page } = useParams();
  return (
    <ConsoleCtx.Provider value={{ hub, page: page ?? "", setBadges: () => {}, refreshMenu: () => {} }}>
      <Outlet />
    </ConsoleCtx.Provider>
  );
}

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

export function renderView(page: string, View: ComponentType, search = "") {
  return render(
    <I18nProvider initial={words}>
      <MemoryRouter future={routerFuture} initialEntries={[hubPath(hub.id, page) + search]}>
        <Routes>
          <Route path="/h/:hubId" element={<Frame />}>
            <Route path=":page" element={<View />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}
