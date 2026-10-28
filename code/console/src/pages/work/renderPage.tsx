import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx, type ConsoleContext } from "../../shell/context";
import type { Hub } from "../../types";
import { callTool } from "../../wakala/mcp";

const words = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

export type Tools = Record<string, (args: Record<string, unknown>) => unknown>;

export type ToolCall = { hubId: string; tool: string; args: Record<string, unknown> };

export function answerTools(tools: Tools): ToolCall[] {
  const calls: ToolCall[] = [];
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (hubId: string, tool: string, args: Record<string, unknown> = {}) => {
    calls.push({ hubId, tool, args });
    if (!Object.hasOwn(tools, tool)) throw new Error(`unexpected tool ${tool}`);
    const answer = tools[tool](args);
    if (answer instanceof Error) throw answer;
    return answer as never;
  });
  return calls;
}

export function renderPage(path: string, element: ReactElement, hub: Partial<Hub> = {}, lang: string = "en") {
  localStorage.setItem("lang", lang);
  const value: ConsoleContext = {
    hub: { id: "h1", name: "Siaya hub", role: "owner", manager_room_id: "room1", ...hub },
    page: path.split("/")[3]?.split("?")[0] ?? "status",
    setBadges: () => {},
    refreshMenu: () => {},
  };
  return render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[path]}>
        <ConsoleCtx.Provider value={value}>
          <Routes>
            <Route path="/h/:hubId/:page" element={element} />
          </Routes>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
}
