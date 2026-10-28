import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { vi } from "vitest";
import { hubPath } from "../../api";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import { callTool } from "../../wakala/mcp";

const table: Record<string, Record<string, string>> = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

export const english = { en: table.en };

export const hubRow = {
  id: "h1",
  name: "Siaya Farmers' Group",
  role: "owner",
  model_key_set: true,
  manager_room_id: "room-m",
};

type Reply = unknown | ((args: Record<string, unknown>) => unknown);

export const answerWith = (replies: Record<string, Reply>) =>
  vi.mocked(callTool).mockImplementation(async (_hubId, tool, args) => {
    if (!Object.hasOwn(replies, tool) && tool === "agency_list_drafts") return { items: [] } as never;
    if (!Object.hasOwn(replies, tool)) throw new Error("unexpected tool " + tool);
    const reply = replies[tool];
    return (typeof reply === "function" ? reply(args ?? {}) : reply) as never;
  });

export const callsOf = (tool: string) =>
  vi
    .mocked(callTool)
    .mock.calls.filter((call) => call[1] === tool)
    .map((call) => call[2]);

export const proposals = () =>
  callsOf("agency_propose_write").map((args) => {
    const sent = args as { kind: string; summary: string; payload: string };
    return { kind: sent.kind, summary: sent.summary, payload: JSON.parse(sent.payload) };
  });

function Frame({ children }: { children: ReactElement }) {
  const { page } = useParams();
  return (
    <ConsoleCtx.Provider value={{ hub: hubRow, page: page ?? "", setBadges: () => {}, refreshMenu: () => {} }}>
      {children}
    </ConsoleCtx.Provider>
  );
}

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

export function renderPage(view: ReactElement, page: string, search = "", state?: unknown) {
  render(
    <I18nProvider initial={english}>
      <MemoryRouter future={routerFuture} initialEntries={[{ pathname: hubPath(hubRow.id, page), search, state }]}>
        <Routes>
          <Route path="/h/:hubId/:page" element={<Frame>{view}</Frame>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}
